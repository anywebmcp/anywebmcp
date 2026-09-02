import { ToolError } from "@anywebmcp/common";
import {
  HACKER_NEWS_ORIGIN,
  HACKER_NEWS_PAGE_REQUEST,
  isHackerNewsPageResponse,
  type HackerNewsOperation,
  type HackerNewsPageOperation
} from "./protocol";
import { HackerNewsTransportError, type HackerNewsTransport } from "./state";

const PROBE_TIMEOUT_MS = 2_000;
const REQUEST_TIMEOUT_MS = 22_000;

type PageWindow = Pick<Window, "addEventListener" | "removeEventListener" | "postMessage" | "setTimeout" | "clearTimeout"> & {
  crypto?: Pick<Crypto, "randomUUID" | "getRandomValues">;
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: number;
};

function requestId(target: PageWindow) {
  if (typeof target.crypto?.randomUUID === "function") {
    return target.crypto.randomUUID().replaceAll("-", "");
  }
  const bytes = new Uint8Array(16);
  target.crypto?.getRandomValues(bytes);
  const random = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(36)}_${random || Math.random().toString(36).slice(2)}`;
}

export function createHackerNewsExtensionTransport(target: PageWindow = window): HackerNewsTransport & { dispose(): void } {
  const pending = new Map<string, PendingRequest>();
  let probe: Promise<void> | undefined;

  const onMessage = (event: MessageEvent) => {
    if (event.source !== target || event.origin !== HACKER_NEWS_ORIGIN) return;
    if (!isHackerNewsPageResponse(event.data)) return;
    const request = pending.get(event.data.requestId);
    if (!request) return;
    pending.delete(event.data.requestId);
    target.clearTimeout(request.timeout);
    if (event.data.ok) request.resolve(event.data.value);
    else request.reject(new HackerNewsTransportError(event.data.code));
  };
  target.addEventListener("message", onMessage as EventListener);

  function send(operation: HackerNewsPageOperation, timeoutMs: number) {
    return new Promise<unknown>((resolve, reject) => {
      const id = requestId(target);
      const timeout = target.setTimeout(() => {
        pending.delete(id);
        reject(new HackerNewsTransportError("transport_unavailable"));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timeout });
      target.postMessage({
        type: HACKER_NEWS_PAGE_REQUEST,
        requestId: id,
        ...operation
      }, HACKER_NEWS_ORIGIN);
    });
  }

  async function ensureAvailable() {
    probe ??= send({ operation: "probe", parameters: {} }, PROBE_TIMEOUT_MS).then(() => undefined);
    try {
      await probe;
    } catch (error) {
      probe = undefined;
      throw error;
    }
  }

  return {
    async request(operation: HackerNewsOperation) {
      try {
        await ensureAvailable();
        return await send(operation, REQUEST_TIMEOUT_MS);
      } catch (error) {
        if (error instanceof HackerNewsTransportError) {
          if (error.code === "transport_unavailable") {
            throw new ToolError(
              "Hacker News extension transport is unavailable. Reload the Hacker News page with the AnyWeb MCP extension enabled."
            );
          }
          throw error;
        }
        throw new HackerNewsTransportError("network");
      }
    },
    dispose() {
      target.removeEventListener("message", onMessage as EventListener);
      for (const request of pending.values()) {
        target.clearTimeout(request.timeout);
        request.reject(new HackerNewsTransportError("transport_unavailable"));
      }
      pending.clear();
    }
  };
}

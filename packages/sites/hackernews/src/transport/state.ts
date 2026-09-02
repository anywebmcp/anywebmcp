import { ToolError } from "@anywebmcp/common";
import type { HackerNewsOperation, HackerNewsTransportErrorCode } from "./protocol";

export type HackerNewsTransport = {
  request(operation: HackerNewsOperation): Promise<unknown>;
};

let activeTransport: HackerNewsTransport | undefined;

export class HackerNewsTransportError extends Error {
  constructor(readonly code: HackerNewsTransportErrorCode) {
    super(code);
    this.name = "HackerNewsTransportError";
  }
}

export function setHackerNewsTransport(transport: HackerNewsTransport | undefined) {
  activeTransport = transport;
}

export function getHackerNewsTransport() {
  if (!activeTransport) {
    throw new ToolError(
      "Hacker News extension transport is unavailable. Reload the Hacker News page with the AnyWeb MCP extension enabled."
    );
  }
  return activeTransport;
}

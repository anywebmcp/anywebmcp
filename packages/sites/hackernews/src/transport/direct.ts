import { ToolError } from "@anywebmcp/common";
import { handleHackerNewsBackgroundRequest, type HackerNewsBackgroundDependencies } from "./background";
import { HACKER_NEWS_BACKGROUND_REQUEST, HACKER_NEWS_ORIGIN, type HackerNewsOperation } from "./protocol";
import { HackerNewsTransportError, type HackerNewsTransport } from "./state";

export function createDirectFetchHackerNewsTransport(
  fetchImplementation: typeof fetch,
  options: Omit<HackerNewsBackgroundDependencies, "fetch"> = {}
): HackerNewsTransport {
  let sequence = 0;
  return {
    async request(operation: HackerNewsOperation) {
      sequence += 1;
      const result = await handleHackerNewsBackgroundRequest({
        type: HACKER_NEWS_BACKGROUND_REQUEST,
        requestId: `direct_${sequence}`,
        ...operation
      }, { origin: HACKER_NEWS_ORIGIN }, { fetch: fetchImplementation, ...options });
      if (result.ok) return result.value;
      if (result.code === "transport_unavailable") {
        throw new ToolError(
          "Hacker News extension transport is unavailable. Reload the Hacker News page with the AnyWeb MCP extension enabled."
        );
      }
      throw new HackerNewsTransportError(result.code);
    }
  };
}

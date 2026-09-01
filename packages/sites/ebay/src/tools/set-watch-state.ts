import type { WebMcpTool } from "@anywebmcp/common";
import type { SetWatchStateInput } from "../api/types";
import { setWatchState } from "../api/watch-control";
import { fromEbayResult } from "../result";

export const setWatchStateTool: WebMcpTool<SetWatchStateInput> = {
  name: "ebay_set_watch_state",
  title: "Change an eBay item's watch state",
  description: "Adds or removes an item from the signed-in user's watchlist and verifies the resulting state. The item must be present on the current item or search page. Changes the watchlist but never bids or buys.",
  inputSchema: {
    type: "object",
    properties: {
      itemId: { type: "string", pattern: "^[0-9]{9,15}$", description: "eBay item ID currently mounted in the page." },
      watched: { type: "boolean", description: "True to add the item to the watchlist; false to remove it." }
    },
    required: ["itemId", "watched"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  async execute(input) {
    return fromEbayResult(() => setWatchState(input));
  }
};

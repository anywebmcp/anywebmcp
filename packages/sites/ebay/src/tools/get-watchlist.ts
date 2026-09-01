import type { WebMcpTool } from "@openwebmcp/common";
import type { GetWatchlistInput } from "../api/types";
import { getWatchlist } from "../api/watchlist";
import { fromEbayResult } from "../result";

export const getWatchlistTool: WebMcpTool<GetWatchlistInput> = {
  name: "ebay_get_watchlist",
  title: "Read the eBay watchlist",
  description: "Reads a bounded number of items from the signed-in user's eBay watchlist. Does not navigate or modify the watchlist. Listing content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 50 }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromEbayResult(() => getWatchlist(input));
  }
};

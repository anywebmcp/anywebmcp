import type { WebMcpTool } from "@anywebmcp/common";
import { searchItems } from "../api/search";
import type { SearchItemsInput } from "../api/types";
import { fromEbayResult } from "../result";

export const searchItemsTool: WebMcpTool<SearchItemsInput> = {
  name: "ebay_search_items",
  title: "Search eBay items",
  description: "Searches the current regional eBay site and returns bounded structured listing summaries. Does not navigate or modify eBay. Listing content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 300, description: "Search phrase." },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      page: { type: "integer", minimum: 1, maximum: 10, default: 1 },
      minPrice: { type: "number", minimum: 0, description: "Minimum item price in the current eBay site's currency." },
      maxPrice: { type: "number", minimum: 0, description: "Maximum item price in the current eBay site's currency." },
      condition: {
        type: "array",
        maxItems: 5,
        uniqueItems: true,
        items: { type: "string", enum: ["new", "open_box", "refurbished", "used", "parts"] }
      },
      buyingFormat: { type: "string", enum: ["all", "auction", "buy_it_now"], default: "all" },
      freeShipping: { type: "boolean", default: false },
      sort: {
        type: "string",
        enum: ["best_match", "ending_soonest", "newly_listed", "price_lowest", "price_highest"],
        default: "best_match"
      }
    },
    required: ["query"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromEbayResult(() => searchItems(input));
  }
};

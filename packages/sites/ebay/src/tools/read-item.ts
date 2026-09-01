import type { WebMcpTool } from "@openwebmcp/common";
import { readItem, type ReadItemInput } from "../api/dom";
import { fromEbayResult } from "../result";

export const readItemTool: WebMcpTool<ReadItemInput> = {
  name: "ebay_read_item",
  title: "Read an eBay item",
  description: "Reads one eBay item by item ID or URL. Uses the current regional eBay session, does not navigate, and never bids, buys, or modifies eBay. Listing content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      item: { type: "string", minLength: 1, maxLength: 2000, description: "A 9-15 digit eBay item ID or item URL on the current regional eBay site." }
    },
    required: ["item"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromEbayResult(() => readItem(input));
  }
};

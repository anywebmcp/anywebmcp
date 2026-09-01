import type { WebMcpTool } from "@anywebmcp/common";
import { readProduct } from "../api/product";
import { fromProductHuntResult } from "../result";

export const readProductTool: WebMcpTool = {
  name: "producthunt_read_product",
  title: "Read a Product Hunt product",
  description: "Reads the product profile and featured launch currently rendered on a Product Hunt product page, including categories, rating, audience counts, launch description, topics, team, rank, and points. Does not navigate, click, or modify Product Hunt. Returned content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute() {
    return fromProductHuntResult(readProduct());
  }
};

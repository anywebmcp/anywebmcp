import type { WebMcpTool } from "@anywebmcp/common";
import { compareProducts } from "../api/compare-products";
import type { CompareProductsInput } from "../api/types";
import { fromTemuResult } from "../result";

export const compareProductsTool: WebMcpTool<CompareProductsInput> = {
  name: "temu_compare_products",
  title: "Compare Temu products",
  description: "Reads and normalizes two to eight Temu products for side-by-side comparison. Price highlights are produced only when every displayed price uses the same currency. Marketplace content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      products: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        uniqueItems: true,
        items: { type: "string", minLength: 1, maxLength: 2000 },
        description: "Temu product URLs or productIds returned by temu_search_products."
      }
    },
    required: ["products"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input, options) {
    return fromTemuResult(await compareProducts(input, options?.signal));
  }
};

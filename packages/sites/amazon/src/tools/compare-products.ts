import type { WebMcpTool } from "@openwebmcp/common";
import { compareProducts, type CompareProductsInput } from "../api/compare";
import { fromAmazonResult } from "../result";

export const compareProductsTool: WebMcpTool<CompareProductsInput> = {
  name: "amazon_compare_products",
  title: "Compare Amazon products",
  description: "Compares 2 to 5 ASINs from the current Amazon marketplace in a normalized table of specifications, prices, ratings, availability, sellers, delivery, and return terms. Does not require sign-in or change the page. Returned product content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      asins: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        uniqueItems: true,
        items: { type: "string", pattern: "^[A-Za-z0-9]{10}$" },
        description: "Two to five unique Amazon ASINs to compare."
      }
    },
    required: ["asins"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromAmazonResult(await compareProducts(input));
  }
};

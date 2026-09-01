import type { WebMcpTool } from "@openwebmcp/common";
import { searchProducts, type SearchProductsInput } from "../api/search";
import { fromAmazonResult } from "../result";

export const searchProductsTool: WebMcpTool<SearchProductsInput> = {
  name: "amazon_search_products",
  title: "Search Amazon products",
  description: "Searches the current Amazon marketplace without changing the page and returns structured product cards. Includes ASIN, canonical URL, image, displayed price, rating, review count, sponsored status, badge, and delivery text when Amazon provides them. Does not add items to the cart or require sign-in. Returned product content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Amazon product search query."
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        default: 10,
        description: "Maximum number of unique product results to return."
      },
      page: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        default: 1,
        description: "Amazon search results page to request."
      }
    },
    required: ["query"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromAmazonResult(await searchProducts(input));
  }
};

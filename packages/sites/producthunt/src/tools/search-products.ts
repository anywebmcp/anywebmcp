import type { WebMcpTool } from "@openwebmcp/common";
import { searchProducts, type SearchProductsInput } from "../api/search";
import { fromProductHuntResult } from "../result";

export const searchProductsTool: WebMcpTool<SearchProductsInput> = {
  name: "producthunt_search_products",
  title: "Search Product Hunt products",
  description: "Searches Product Hunt products by fetching one public search-results page without navigating the current tab. Returns product URLs, taglines, review data, logos, and pagination status. Does not click or modify Product Hunt. Returned content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Product search query."
      },
      page: {
        type: "integer",
        minimum: 1,
        maximum: 1000,
        default: 1,
        description: "Product Hunt search-results page to fetch."
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        default: 10,
        description: "Maximum number of products to return from the fetched page."
      }
    },
    required: ["query"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromProductHuntResult(await searchProducts(input));
  }
};

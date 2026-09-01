import type { WebMcpTool } from "@anywebmcp/common";
import { readReviews, type ReadReviewsInput } from "../api/reviews";
import { fromAmazonResult } from "../result";

export const readReviewsTool: WebMcpTool<ReadReviewsInput> = {
  name: "amazon_read_reviews",
  title: "Read Amazon product reviews",
  description: "Returns full review texts available on an Amazon product page and can filter them by star rating and a text query such as battery, durability, or size. Results can keep Amazon's featured order or be sorted locally by date or helpful votes. Does not require sign-in. Returned review content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      asin: { type: "string", pattern: "^[A-Za-z0-9]{10}$", description: "The product's 10-character Amazon ASIN." },
      rating: { type: "integer", minimum: 1, maximum: 5, description: "Optional exact star rating filter from 1 to 5." },
      query: { type: "string", maxLength: 200, description: "Optional case-insensitive text filter applied to review title, body, and variant." },
      sort: { type: "string", enum: ["featured", "recent", "helpful"], default: "featured", description: "Review ordering. Recent and helpful are computed within the available review sample." },
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10, description: "Maximum number of reviews to return." }
    },
    required: ["asin"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromAmazonResult(await readReviews(input));
  }
};

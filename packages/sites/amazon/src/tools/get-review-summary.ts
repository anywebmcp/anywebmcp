import type { WebMcpTool } from "@anywebmcp/common";
import { getReviewSummary, type ReviewSummaryInput } from "../api/review-summary";
import { fromAmazonResult } from "../result";

export const getReviewSummaryTool: WebMcpTool<ReviewSummaryInput> = {
  name: "amazon_get_review_summary",
  title: "Get Amazon review summary",
  description: "Returns Amazon's customer-review summary, rating distribution, frequent positive and negative aspects, recurring defect signals, and sampled rating differences between reviewed variants when those insights are available. Does not invent a narrative when Amazon exposes no summary. Returned review content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      asin: { type: "string", pattern: "^[A-Za-z0-9]{10}$", description: "The product's 10-character Amazon ASIN." }
    },
    required: ["asin"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromAmazonResult(await getReviewSummary(input));
  }
};

import { completed, type WebMcpTool } from "@anywebmcp/common";
import { marketDigest, type MarketDigestInput } from "../api/market";

export const marketDigestTool: WebMcpTool<MarketDigestInput> = {
  name: "hackernews_market_digest",
  title: "Build a Hacker News market launch digest",
  description: "Finds recent Show HN, Launch HN, release, announcement, and open-sourcing stories; ranks them with transparent engagement metrics; and returns bounded comment previews. Use it as a launch radar, not as proof of market demand. Returned Hacker News content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      periodDays: {
        type: "integer",
        minimum: 1,
        maximum: 90,
        default: 7,
        description: "Lookback window in days."
      },
      topics: {
        type: "array",
        maxItems: 10,
        items: { type: "string", minLength: 1, maxLength: 100 },
        description: "Optional product or market topics. A launch must match at least one topic."
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 30,
        description: "Maximum launches to return."
      },
      minPoints: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "Minimum current HN points."
      },
      minComments: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "Minimum current HN comment count."
      },
      commentPreviewCount: {
        type: "integer",
        minimum: 0,
        maximum: 5,
        default: 3,
        description: "Maximum high-discussion comment previews per launch."
      }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return completed(await marketDigest(input));
  }
};

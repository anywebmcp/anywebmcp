import type { WebMcpTool } from "@openwebmcp/common";
import { collectListing, type CollectListingInput } from "../api/dom";
import { fromRedditResult } from "../result";

export const collectListingTool: WebMcpTool<CollectListingInput> = {
  name: "reddit_collect_listing",
  title: "Collect Reddit listing posts",
  description: "Collects a bounded number of posts from the current Reddit feed, subreddit, search, or profile listing. It may scroll the page, restores the original position by default, skips promoted posts, and never modifies Reddit data. Returned Reddit content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 20,
        description: "Maximum number of unique non-promoted posts to collect."
      },
      maxScrolls: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        default: 5,
        description: "Maximum number of downward page scrolls."
      },
      restorePosition: {
        type: "boolean",
        default: true,
        description: "Restore the original scroll position after collection."
      }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromRedditResult(await collectListing(input));
  }
};

import type { WebMcpTool } from "@anywebmcp/common";
import { collectFeedPosts, type CollectFeedPostsInput } from "../api/dom";
import { fromLinkedInResult } from "../result";

export const collectFeedPostsTool: WebMcpTool<CollectFeedPostsInput> = {
  name: "linkedin_collect_feed_posts",
  title: "Collect LinkedIn feed posts",
  description: "Collects a bounded number of LinkedIn feed posts by scrolling at most maxScrolls times. Restores the original position by default and never modifies LinkedIn data. Returned post content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 20,
        description: "Maximum number of unique posts to collect."
      },
      maxScrolls: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        default: 5,
        description: "Maximum number of downward feed scrolls."
      },
      restorePosition: {
        type: "boolean",
        default: true,
        description: "Restore the original scroll position after collection."
      },
      includeFullText: {
        type: "boolean",
        default: false,
        description: "Return full captured text for every collected post. Leave false for compact ranking; call read_post only for a selected truncated post when needed."
      }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromLinkedInResult(await collectFeedPosts(input));
  }
};

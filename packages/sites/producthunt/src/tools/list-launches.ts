import type { WebMcpTool } from "@openwebmcp/common";
import { listLaunches, type ListLaunchesInput } from "../api/dom";
import { fromProductHuntResult } from "../result";

export const listLaunchesTool: WebMcpTool<ListLaunchesInput> = {
  name: "producthunt_list_launches",
  title: "List Product Hunt launches",
  description: "Lists launch cards currently rendered in Product Hunt's main content, including displayed rank or page order, tagline, topics, comment count, and upvote count. Does not navigate, scroll, click, vote, or modify Product Hunt. Returned product content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      section: {
        type: "string",
        enum: ["all", "today", "yesterday", "last_week", "last_month"],
        default: "all",
        description: "Optional homepage section filter. Use all on leaderboard and other Product Hunt pages."
      },
      offset: {
        type: "integer",
        minimum: 0,
        maximum: 1000,
        default: 0,
        description: "Zero-based offset into matching launch cards."
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 20,
        description: "Maximum number of launch cards to return."
      }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute(input) {
    return fromProductHuntResult(listLaunches(input));
  }
};

import { completed, type WebMcpTool } from "@anywebmcp/common";
import { readPosts, type GetPostsInput } from "../dom/read-posts";

export const getPostsTool: WebMcpTool<GetPostsInput> = {
  name: "x_get_posts",
  title: "Get X posts",
  description: "Returns posts and attached content in display order from the current X timeline, profile, search, or conversation. visible reads only the current viewport without moving the page. batch includes visible posts and continues downward up to limit. next continues after afterPostId from an earlier result on the same page with the same filter. batch and next may scroll and leave the page near the last returned post. Does not open another page or expand hidden replies. Returns page and reply context, lastPostId, and a stopReason when the viewport, limit, conversation end, stalled loading, or work budget is reached.",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["visible", "batch", "next"], default: "visible" },
      limit: { type: "integer", minimum: 1, maximum: 100,
        description: "Maximum returned posts after filtering. Defaults to all visible posts for visible, or 20 for batch and next. Never causes visible mode to load more." },
      afterPostId: { type: "string", pattern: "^[0-9]+$",
        description: "Required only for next. Use lastPostId from an earlier result in this page session with the same filter. Reloading or an observed change of page, tab, or reply order invalidates continuation." },
      filter: { type: "string", enum: ["all", "replies"], default: "all",
        description: "Return all posts or only identified replies. Conversation replies include nested responses, not necessarily only direct replies to the subject post." }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input, options) {
    return completed(await readPosts(input, options?.signal));
  }
};

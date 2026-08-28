import type { WebMcpTool } from "@openwebmcp/common";
import { getVisiblePosts } from "../dom/posts";
import { textResult } from "../result";

export const getPostsTool: WebMcpTool = {
  name: "x_get_posts",
  title: "Get visible X posts",
  description: "Returns the posts and attached content shown on the current X page without loading more.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute() {
    const posts = getVisiblePosts();
    return textResult({ count: posts.length, posts });
  }
};

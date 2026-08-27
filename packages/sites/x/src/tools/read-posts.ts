import type { WebMcpTool } from "@openwebmcp/common";
import { getCapturedPosts } from "../api/network";
import { textResult } from "../result";

type ReadPostsInput = {
  limit?: number;
};

export const readPostsTool: WebMcpTool<ReadPostsInput> = {
  name: "x_read_posts",
  title: "Read X posts",
  description: "Returns posts captured from X's own GraphQL responses in the current page session without reading the DOM.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute({ limit = 20 }) {
    const posts = getCapturedPosts(limit);
    return textResult({ count: posts.length, posts });
  }
};

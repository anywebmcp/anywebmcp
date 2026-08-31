import type { WebMcpTool } from "@openwebmcp/common";
import { ensurePost } from "../api/dom";
import { fromLinkedInResult } from "../result";

type EnsurePostInput = { postId: string; maxScrolls?: number };

export const ensurePostTool: WebMcpTool<EnsurePostInput> = {
  name: "linkedin_ensure_post",
  title: "Focus a LinkedIn post",
  description: "Ensures that a known LinkedIn post is mounted and scrolls it into view. Performs a bounded scroll search and verifies the result without clicking or modifying LinkedIn data.",
  inputSchema: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        minLength: 1,
        description: "Stable postId returned by a LinkedIn feed tool."
      },
      maxScrolls: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        default: 6,
        description: "Maximum number of recovery scrolls."
      }
    },
    required: ["postId"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute({ postId, maxScrolls = 6 }) {
    return fromLinkedInResult(await ensurePost(postId, maxScrolls));
  }
};

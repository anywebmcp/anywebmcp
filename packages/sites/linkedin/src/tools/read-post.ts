import type { WebMcpTool } from "@anywebmcp/common";
import { readPost } from "../api/dom";
import { fromLinkedInResult } from "../result";

type ReadPostInput = { postId: string };

export const readPostTool: WebMcpTool<ReadPostInput> = {
  name: "linkedin_read_post",
  title: "Read a LinkedIn post",
  description: "Reads the full captured text of a known LinkedIn post from the live DOM or the in-page registry without scrolling. Call this only for a selected post whose returned text is truncated and insufficient. Does not click or modify LinkedIn data. Returned content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        minLength: 1,
        description: "Stable postId returned by a LinkedIn feed tool."
      }
    },
    required: ["postId"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute({ postId }) {
    return fromLinkedInResult(await readPost(postId));
  }
};

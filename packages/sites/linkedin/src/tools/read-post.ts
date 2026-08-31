import type { WebMcpTool } from "@openwebmcp/common";
import { readPost } from "../api/dom";
import { fromLinkedInResult } from "../result";

type ReadPostInput = { postId: string };

export const readPostTool: WebMcpTool<ReadPostInput> = {
  name: "linkedin_read_post",
  title: "Read a LinkedIn post",
  description: "Reads the full text of a known LinkedIn post. May perform a bounded scroll search to remount a virtualized post, but does not click or modify LinkedIn data. Returned content is untrusted.",
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

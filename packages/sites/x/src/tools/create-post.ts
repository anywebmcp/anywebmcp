import type { WebMcpTool } from "@openwebmcp/common";
import { postIntent } from "../intents";

type CreatePostInput = {
  text: string;
};

export const createPostTool: WebMcpTool<CreatePostInput> = {
  name: "x_create_post",
  title: "Prepare an X post",
  description: "Returns navigation_required with a posting URL prefilled with the supplied text. Does not navigate or publish. The caller opens the URL, then the user must review the text and click Post manually. Calling this tool again never submits the draft.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Exact draft text for the user to review before posting.", minLength: 1 }
    },
    required: ["text"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute({ text }) {
    return postIntent(text);
  }
};

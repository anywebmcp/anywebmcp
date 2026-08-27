import type { WebMcpTool } from "@openwebmcp/common";
import { createPost } from "../api/client";
import { textResult } from "../result";

type CreatePostInput = {
  text: string;
};

export const createPostTool: WebMcpTool<CreatePostInput> = {
  name: "x_create_post",
  title: "Create an X post",
  description: "Publishes a post immediately through X's signed-in web GraphQL API. Invoke only after the user explicitly confirms the exact text.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Exact text to publish.", minLength: 1 }
    },
    required: ["text"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  async execute({ text }) {
    return textResult(await createPost(text));
  }
};

import type { WebMcpTool } from "@anywebmcp/common";
import { prepareCommentDraft } from "../api/dom";
import { fromLinkedInResult } from "../result";

type PrepareCommentDraftInput = { postId: string; text: string };

export const prepareCommentDraftTool: WebMcpTool<PrepareCommentDraftInput> = {
  name: "linkedin_prepare_comment_draft",
  title: "Prepare a LinkedIn comment draft",
  description: "Ensures the post is mounted, opens its comment editor, inserts the requested draft, and reads it back for verification. Changes the page UI but never submits or publishes the comment; the user must review it and click LinkedIn's Comment button manually.",
  inputSchema: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        minLength: 1,
        description: "Stable postId returned by a LinkedIn feed tool."
      },
      text: {
        type: "string",
        minLength: 1,
        maxLength: 1250,
        description: "Comment draft to insert for the user's review without submitting."
      }
    },
    required: ["postId", "text"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  async execute({ postId, text }) {
    return fromLinkedInResult(await prepareCommentDraft(postId, text));
  }
};

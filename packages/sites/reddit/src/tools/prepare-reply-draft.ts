import type { WebMcpTool } from "@anywebmcp/common";
import { prepareReplyDraft } from "../api/dom";
import { fromRedditResult } from "../result";

type PrepareReplyDraftInput = { targetId: string; text: string };

export const prepareReplyDraftTool: WebMcpTool<PrepareReplyDraftInput> = {
  name: "reddit_prepare_reply_draft",
  title: "Prepare a Reddit reply draft",
  description: "Finds a post or comment in the current Reddit thread, opens its reply editor when needed, inserts the requested draft, and reads it back for verification. It changes the visible page UI but never clicks Reddit's submit, Comment, or Reply action; the user must review and publish manually.",
  inputSchema: {
    type: "object",
    properties: {
      targetId: {
        type: "string",
        pattern: "^t[13]_[a-z0-9]+$",
        description: "Reddit fullname returned as postId or commentId, such as t3_abc or t1_xyz."
      },
      text: {
        type: "string",
        minLength: 1,
        maxLength: 10000,
        description: "Reply draft to insert for the user's review without submitting."
      }
    },
    required: ["targetId", "text"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  async execute({ targetId, text }) {
    return fromRedditResult(await prepareReplyDraft(targetId, text));
  }
};

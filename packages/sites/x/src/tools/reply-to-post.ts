import { failed, type WebMcpTool } from "@anywebmcp/common";
import { postIntent } from "../intents";

type ReplyToPostInput = { postId: string; text: string };

export const replyToPostTool: WebMcpTool<ReplyToPostInput> = {
  name: "x_reply_to_post",
  title: "Prepare an X reply",
  description: "Returns navigation_required with a reply URL for the supplied post ID, prefilled with the supplied text. Does not navigate or publish. The caller opens the URL, then the user must review the target and text and click Reply manually. Calling this tool again never submits the draft.",
  inputSchema: {
    type: "object",
    properties: {
      postId: { type: "string", pattern: "^[0-9]+$", description: "ID of the X post to reply to." },
      text: { type: "string", minLength: 1, description: "Exact draft reply for the user to review." }
    },
    required: ["postId", "text"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute({ postId, text }) {
    if (!/^\d+$/.test(postId)) return failed("Post ID must contain only digits.");
    return postIntent(text, postId);
  }
};

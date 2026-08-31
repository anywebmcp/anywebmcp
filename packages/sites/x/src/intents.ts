import { failed, navigationRequired } from "@openwebmcp/common";

export function postIntent(text: string, postId?: string) {
  if (!text.trim()) return failed("Post text cannot be empty.");

  const url = new URL("https://x.com/intent/tweet");
  url.searchParams.set("text", text);
  if (postId) url.searchParams.set("in_reply_to", postId);

  const target = postId ? `reply to post ${postId}` : "post";
  const button = postId ? "Reply" : "Post";
  return navigationRequired(url.href,
    `Open this URL to prepare a ${target} with text ${JSON.stringify(text)}, then stop for user review. The user must confirm the draft by clicking ${button} in X manually. Do not click the button or call the tool again to submit. Nothing has been published.`);
}

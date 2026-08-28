# LinkedIn WebMCP package

This package exposes DOM-backed WebMCP tools on `www.linkedin.com`:

- `linkedin_list_loaded_posts` lists posts currently mounted in the page without scrolling.
- `linkedin_collect_feed_posts` performs bounded feed scrolling, deduplicates posts, and restores the original position by default.
- `linkedin_read_post` returns the full text of a previously discovered post.
- `linkedin_ensure_post` makes a bounded attempt to remount and focus a virtualized post.
- `linkedin_prepare_comment_draft` opens a comment editor, inserts text, and verifies the visible draft without submitting it.

LinkedIn virtualizes its feed, so the adapter maintains a bounded in-page registry of recently observed posts. It prefers LinkedIn activity URNs and canonical URLs, with a deterministic author-and-text fingerprint as a fallback. Later tools can use any returned `postId` while the current page session remains alive.

The adapter never publishes a comment. Draft preparation changes the visible LinkedIn UI, reads the editor text back, and returns `submitted: false`; the user must review the field and click LinkedIn's Comment button manually.

This integration depends on LinkedIn's current DOM structure and accessibility labels. Selectors may require maintenance when LinkedIn changes its frontend. Returned post text is marked as untrusted content, collection is capped at 50 posts and 10 scrolls, and recovery searches are always bounded.

The implementation was adapted from [`KostyaDanovsky/linkedin-webmcp-bridge`](https://github.com/KostyaDanovsky/linkedin-webmcp-bridge) to OpenWebMCP's site-package structure.

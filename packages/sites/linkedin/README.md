# LinkedIn WebMCP package

This package exposes DOM-backed WebMCP tools on `https://www.linkedin.com/*`. The tools are intended for feed pages and post surfaces where LinkedIn mounts feed-update cards:

- `linkedin_list_loaded_posts` lists posts currently mounted in the page without scrolling.
- `linkedin_collect_feed_posts` performs bounded scrolling in LinkedIn's actual feed container, deduplicates posts, and restores the original position by default. It can optionally return full captured text for every post.
- `linkedin_read_post` returns the full captured text of a previously discovered post from the live DOM or the in-page registry without remounting it.
- `linkedin_ensure_post` makes a bounded attempt to remount and focus a virtualized post.
- `linkedin_prepare_comment_draft` opens a comment editor, inserts text, and verifies the visible draft without submitting it.

Tools follow the [shared result contract](../../../docs/tool-result-contract.md). Successful calls return `status: "completed"` with their payload under `data`. The site result adapter removes the internal `ok` flag and converts failures to `status: "failed"`, keeping error codes, recovery instructions, and post URLs in `message`. The common wrapper handles response formatting. These tools do not request navigation or persist continuations.

LinkedIn virtualizes its feed, so the adapter maintains a bounded in-page registry of recently observed posts. It prefers LinkedIn activity URNs and canonical URLs, with a deterministic author-and-text fingerprint as a fallback. Later tools can use any returned `postId` while the current page session remains alive.

Feed discovery returns compact text by default. Use that text directly for ranking, and call `linkedin_read_post` only when the selected post is marked `truncated` and the omitted text is necessary. Set `includeFullText: true` on collection when ranking requires full captured text for every result.

The adapter never publishes a comment. Draft preparation changes the visible LinkedIn UI, refuses to overwrite a different non-empty draft, reads the editor text back, and returns `submitted: false`; the user must review the field and click LinkedIn's Comment button manually.

## DOM and localization assumptions

The integration recognizes current feed cards through `mainFeed`, `feed-full-update`, activity URNs, legacy feed-update classes, article/list-item roles, and commentary component keys. It reads authors, post text, and permalinks from current `data-view-name` attributes first and retains legacy LinkedIn class fallbacks. Posts shorter than 40 normalized characters are ignored to avoid treating page chrome as feed content.

Comment-editor discovery uses contenteditable textboxes inside the mounted post. Comment and retry controls prefer structural attributes, then exact English and Russian accessibility labels or visible text. Other localized labels are not currently enumerated, so LinkedIn localization or frontend changes can make editor opening fail safely. The adapter never finds or clicks the final submit control.

The package uses either the nearest scrollable ancestor of a mounted feed card or the window. Element scrolling depends on computed `overflow-y` and scroll dimensions. LinkedIn virtualization may unmount cards; recovery searches around the last observed position and re-parses the live DOM after every bounded step.

## Authentication, limits, and failures

Tools use only the current LinkedIn browser session. They make no direct or cross-origin requests and do not read or expose cookies, tokens, or headers. On a signed-out or inaccessible page, no feed cards may be mounted: list and collection calls can complete with an empty post set, while post-specific calls fail with recovery guidance. LinkedIn challenge and access-control pages are not bypassed.

Returned post text is marked as untrusted content. Captured text is capped at 10,000 characters and compact feed responses at 700 characters. Listing pages return at most 25 posts per call. Collection is capped at 50 posts and 10 scrolls, the in-page identity registry retains at most 200 posts, and remount searches are capped at 10 steps. Draft text is capped at 1,250 characters. Collection restores the original position by default.

Expected DOM, registry, editor, and failure outcomes are covered by sanitized offline fixtures. Run the package tests with:

```sh
npm test -w @openwebmcp/site-linkedin
```

The root `npm test` command includes this package.

The implementation was adapted from [`KostyaDanovsky/linkedin-webmcp-bridge`](https://github.com/KostyaDanovsky/linkedin-webmcp-bridge) to OpenWebMCP's site-package structure.

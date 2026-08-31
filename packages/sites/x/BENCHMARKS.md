# X benchmarks

Historical character-count comparison for the earlier mounted-post reader (not a benchmark of the current modes):

| Tool | Browser | WebMCP | Reduction |
| --- | ---: | ---: | ---: |
| `x_get_posts` | 16,868 chars | 5,286 chars | 69% |

## Post retrieval modes — 2026-08-31

`x_get_posts` now supports `visible`, `batch`, and anchored `next`, with reply filtering and page context. The historical comparison above no longer measures its current behavior.

Verification used Chrome, the production tool bundled into a temporary local preview, and a synthetic virtualized feed with delayed loading. No test files were added to the repository. Manual checks confirmed:

- `visible` returned three viewport posts without scrolling; `limit: 1` returned one post without moving from a mid-feed position.
- A 20-post batch returned IDs 1–20. Another started with partially visible ID 10 and returned IDs 10–29, with no earlier offscreen cards.
- `next` after ID 20 returned IDs 21–30. After scrolling back to the top and unmounting ID 29, continuation remounted that anchor and returned IDs 30–34.
- Reply-only collection returned seven conversation replies, excluding the subject and stopping before the recommendation section.
- A reply inside a quote did not mark its outer post as a reply, and quoted content did not count toward limits.
- Cross-page continuation failed without scrolling. Cancellation propagated and released the reader for a subsequent visible read.
- Changing the selected feed during a read stopped it with a failure. A two-card snapshot requested with a limit of five returned two posts and `stalled`, not a false exhaustion signal.

The live X conversation layout was inspected without posting or reacting. Two public X article DOM snapshots were also parsed through the production tool in the local preview: the subject, its quoted post, and a following reply were identified correctly. Image and media network loads were blocked in that preview.

We ran `x_get_posts({ mode: "batch", limit: 10 })` through native WebMCP in the signed-in in-app Browser after fixing optional cancellation-signal handling and restarting the app. This live smoke check returned 10 unique posts in 1,070 ms, with `status: "completed"`, `stopReason: "limit"`, and four downward scrolls. The last post matched `lastPostId`; six posts included nested quotes. Some text was truncated, and the quoted posts had null IDs and URLs.

`npm run build`, an X-package strict TypeScript check, and `git diff --check` passed. A live WebMCP-versus-browser benchmark remains pending. The single-call duration above excludes navigation and measures no token savings. Run at least three alternating, equivalent-start runs per approach under the [benchmarking process](../../../docs/benchmarking-site-tools.md) before publishing a new comparison.

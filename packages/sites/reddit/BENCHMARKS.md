# Reddit WebMCP benchmarks

No live Reddit benchmark results are recorded yet.

On August 31, 2026, the Codex in-app browser returned Reddit's human-verification page and direct public JSON requests returned a network-security block. The adapter does not bypass either control. A separate signed-in Chrome session was available for read-only live DOM validation, but the local fixture smoke test and live probes below are not substitutes for the three-run benchmark required by `docs/benchmarking-site-tools.md`.

## Live DOM validation

The adapter's extraction JavaScript was executed directly against Reddit without invoking the registered WebMCP tools:

- The home feed exposed 28 `shreddit-post` candidates; 10 sampled posts returned stable `t3_` IDs, Reddit permalinks, subreddit, title, author, post type, timestamp, score, and comment count.
- Two bounded feed scrolls increased the observed set from 3 initially mounted posts to 28 unique stable IDs.
- A live thread exposed its `shreddit-post` plus 9 initially mounted `shreddit-comment` elements with stable `t1_` IDs, parent IDs, depths, bodies, scores, authors, and permalinks. Expanding one visible `more reply` control increased the count to 10.
- Reddit's `/r/selfhosted/about/rules` redirected to `/mod/selfhosted/rules/`; 6 `mod-rule-item` elements were parsed from their `rule-obj` attributes with ordered titles and descriptions.
- Opening a visible comment Reply control exposed a contenteditable editor scoped to the correct `t1_` comment. The final `Comment` button was inside `shreddit-composer`; no text was entered and nothing was submitted.

## Direct adapter validation

The exact exports bundled from `src/api/dom.ts` were invoked directly on local fixtures without WebMCP registration or calls:

- `collectListing` returned the expected `t3_` post, normalized metadata, and embedded page context.
- `readThread` returned the post and two flat comments with correct `t1_` IDs, parents, depths, and OP state; `partial` was `false` when no expandable comments remained.
- `getCommunityRules` returned sidebar rules and separately parsed `/mod/typescript/rules/` `mod-rule-item[rule-obj]` data with `complete: true`.
- `prepareReplyDraft` opened a hidden contenteditable initialized with an empty `<br>`, inserted and verified the requested text, and returned `submitted: false`.
- A second draft attempt returned `EDITOR_NOT_EMPTY`, preserved the original text, and left the fixture submit counter at `0`.

Run the benchmark after a human has established an accessible Reddit browser session. Use safe, user-directed tasks and record at least three alternating runs for:

- collecting posts from one current subreddit listing;
- reading one current discussion thread;
- reading one community's rules page;
- preparing, but not submitting, one reply draft in controlled test data.

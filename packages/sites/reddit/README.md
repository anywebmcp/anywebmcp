# Reddit WebMCP package

This package exposes bounded DOM-backed WebMCP tools on `www.reddit.com` and `old.reddit.com`:

- `reddit_collect_listing` collects posts from the current feed, subreddit, search, or profile listing.
- `reddit_read_thread` reads the current post and a bounded flat tree of comments.
- `reddit_get_community_rules` reads rules present in the current page; the community's `/about/rules` page, including Reddit's `/mod/<community>/rules/` redirect, provides the complete set.
- `reddit_prepare_reply_draft` opens a post or comment reply editor, inserts text, and verifies the visible draft without submitting it.

Every successful result contains `pageContext`, including the page type, subreddit, post ID, sort, access status, and coarse authentication status. Failed results include the same serialized context in their diagnostic message. This avoids requiring an extra context-tool call before each useful operation.

## Implementation and safety

The adapter uses Reddit's rendered DOM and the user's existing browser session. It recognizes modern `shreddit-*` custom elements, Reddit Search's `search-sdui-post` result containers, and common legacy Reddit containers. Reply drafting also recognizes post-scoped `comment-composer-host` elements and Reddit's Lexical contenteditable alongside legacy textareas. Modern custom textarea triggers are activated through their pointer/focus sequence, and newly mounted unscoped editors are considered only after that activation so an existing post draft cannot be mistaken for a comment draft. Stable Reddit fullnames (`t3_` for posts and `t1_` for comments) are preferred, with permalinks and deterministic fingerprints as bounded fallbacks for listings.

The implementation stays local to this package and separates page/access detection, DOM helpers, post and comment parsing, community rules, the bounded in-page post registry, and reply-editor interaction. `src/api/dom.ts` is a compatibility facade for the four tool operations; importing it does not inspect or mutate the page.

Reads are deliberately limited to 50 posts, 200 comments, 20 levels of comment depth, 20 visible comment expansions, and 10 listing scrolls. Promoted posts are excluded. Reddit content is marked as untrusted, registry state remains in the current page session, and no cookies, tokens, modhashes, private messages, or persistent content copies are exposed.

The package does not publish replies, create posts, vote, save, join communities, send messages, solve CAPTCHAs, or bypass Reddit access controls. Draft preparation refuses to overwrite a different existing draft and returns `submitted: false`; the user must review the editor and publish through Reddit's normal UI.

Reddit may present human verification or network security blocks. Tools return `HUMAN_VERIFICATION_REQUIRED` or `NETWORK_BLOCKED` with a suggested user action and do not attempt a bypass.

## Limitations

Reddit's frontend and custom-element attributes can change without notice. Community rules are complete only on the community's rules surface (`/about/rules` or Reddit's `/mod/<community>/rules/` redirect). Comment expansion is limited to visible buttons, and deeply collapsed or navigated subthreads may require the user or browser agent to open the relevant permalink first.

Before publicly distributing or operating this adapter, review Reddit's current Developer Terms, Data API Terms, and Responsible Builder Policy. The adapter is intentionally scoped as a user-directed page assistant, not a crawler or bulk data collector.

For local native WebMCP testing, enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome before loading `packages/extension/dist` as an unpacked extension.

## Tests

Run the package's deterministic offline fixture and wrapped-contract tests with:

```sh
npm test -w @anywebmcp/site-reddit
```

The package also participates in the root `npm test` workspace run. Fixtures cover modern and old Reddit listings and threads, rule surfaces, access states, stable and fallback IDs, bounded comment expansion, and draft insertion without submission. No Reddit credentials or network access are required.

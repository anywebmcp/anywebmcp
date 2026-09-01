# X WebMCP package

This package exposes WebMCP tools on `x.com` and `twitter.com`:

- `x_get_api_status` reports captured GraphQL operations and readiness.
- `x_get_posts` reads visible posts, a bounded batch, or the next batch on the current page.
- `x_create_post` returns a prefilled posting intent for manual review and submission.
- `x_reply_to_post` returns a prefilled reply intent for manual review and submission.

## Results

Tools follow the [shared result contract](../../../docs/tool-result-contract.md). Successful reads return `status: "completed"` with their payload under `data`; failures return `status: "failed"` with a message. The common wrapper handles formatting and exceptions. Posting and reply tools return `navigation_required` with the prefilled intent URL and instructions for manual submission; they never report a published post.

## Reading posts

`x_get_posts` supports three modes on the current timeline, profile, search, bookmarks, list, or conversation page:

```js
x_get_posts({ mode: "visible" });
x_get_posts({ mode: "batch", limit: 20 });
x_get_posts({ mode: "next", afterPostId: "<lastPostId from the previous result>", limit: 20 });
```

- `visible` (default) returns posts intersecting the viewport without scrolling. An optional `limit` only caps that snapshot.
- `batch` starts at the first partially visible post and reads downward, including posts already visible. It scrolls to load more as needed.
- `next` starts strictly after a previously returned post. Pass the result's `lastPostId` as `afterPostId`, using the same page and filter. An unknown or unavailable anchor fails rather than restarting at the current viewport.

`batch` and `next` default to 20 posts and accept limits from 1 to 100. They leave the page near the last returned post when that card remains mounted. Calls never navigate to another page, change the selected tab or reply order, or expand collapsed replies. Caller cancellation stops further scrolling; it does not restore the previous position.

Use `filter: "replies"` to return only identified replies; the default is `all`. Limits apply after filtering and deduplication by post ID. Quoted posts remain nested and do not count toward the limit. A conversation's reply section can contain nested responses, so these are not guaranteed to be direct replies to its subject.

Results retain `count` and `posts`, and add `page`, `mode`, `filter`, `requestedLimit`, `lastPostId`, `scrollsPerformed`, and `stopReason`. The reasons are `viewport`, `limit`, `end` (the identified conversation reply section ended), `stalled` (loading made no progress), and `budget` (30 seconds or 60 downward scrolls). A stalled feed is not reported as exhausted. A completed read can return fewer posts than requested.

`scrollsPerformed` counts downward loading steps, excluding anchor recovery and final positioning.

`page` includes its URL, kind, selected tab, reply order, and conversation subject ID when available. Top-level posts add `context` with `role`, `section`, and the visible `replyingTo` handles. Roles distinguish timeline items, the conversation subject, ancestors above it, replies, and related recommendations. When a conversation is opened midway through a virtualized section and there is insufficient context, the role is `unknown`; those posts are excluded by the replies filter. Start near the subject to establish that context.

The reader queries `article[data-testid="tweet"]` cards within `primaryColumn` (falling back to `main`) and extracts each post's permalink, author, text, timestamp, engagement metrics, media, link previews, quoted post, and repost attribution. It uses the rendered page for membership and ordering, not the pooled network capture. Offscreen mounted cards can supply a batch, but are excluded from `visible`.

Continuation references are tab-local, in-memory anchors for the latest 200 returned posts, not API cursors. If X has unmounted an anchor, the reader tries its recorded scroll position for up to three seconds. References are cleared on an observed page, tab, or reply-order change and lost on reload. Reordered feeds and layout shifts can invalidate them. Overlapping reads are rejected so their scrolling cannot interfere.

The adapter uses X's `tweet`, `tweetText`, `User-Name`, `tweetPhoto`, `card.wrapper`, `socialContext`, `reply`, `retweet`, and `like` test IDs. It identifies quoted posts from their nested link container. X may change these selectors without notice.

Reply handles outside conversations use the English `Replying to` label, excluding quoted content. Conversation classification follows the subject's position, previously observed overlapping cards, and English recommendation headings such as `Discover more`. Reply-order detection recognizes `Relevant`, `Latest`, `Most recent`, and `Most liked`. These labels and section boundaries may differ in other locales or future X versions.

Top-level and quoted posts use the same recursive content shape; only top-level posts add page context. Image attachments include their rendered URL and alt text. Video and GIF attachments include a portable source URL when X exposes one and a preview image otherwise. Image collection is limited to X media and video-thumbnail assets so avatars and emoji are excluded. X often exposes playback through session-only `blob:` URLs, which the tool omits. Compact quoted cards may not expose identity, timestamp, or metrics, so those fields are `null`.

## Network capture

The X extension entrypoint explicitly starts capture before mounting the site. That entrypoint runs at `document_start`, so capture still patches `fetch` early enough to observe X's GraphQL operations and transaction IDs. Importing the site package itself has no browser side effects. `x_get_api_status` exposes the diagnostic state.

## Posting and replies

```js
x_create_post({ text: "Hello twttr" });
x_reply_to_post({ postId: "<target post ID>", text: "Reply text" });
```

Both tools only build a URL and return `navigation_required`. The posting URL is `https://x.com/intent/tweet?text=…`; replies add `in_reply_to=<postId>`. `URLSearchParams` preserves the supplied text, including line breaks and special characters. Blank text and invalid reply IDs fail without producing a URL.

The caller opens the returned URL, then stops for user confirmation. The user checks the signed-in account, draft text, and reply target and clicks Post or Reply manually in X. The instruction includes the exact text for review. No second tool invocation is needed: calling either tool again just returns the same URL, even when the intent is already open.

There is no composer inspection, button clicking, submission tracking, storage access, API request, or publication detection. The tools are read-only URL builders and never return `completed` for publication. This also means they do not verify that X loaded or accepted the draft.

The intent flow uses the existing X login and needs no API credentials. X controls authentication, account permissions, and text limits, and currently redirects `/intent/tweet` to `/intent/post`. Media, polls, quotes, threads, and scheduling are outside the tools' scope.

## Support and account risk

Automating the composer is website scripting. X's [automation rules](https://help.x.com/en/rules-and-policies/x-automation) prohibit non-API website scripting and warn that it may result in account suspension. The [official X API](https://docs.x.com/x-api/getting-started/about-x-api) supports production integrations through application OAuth.

## Local testing

Run `npm test -w @anywebmcp/site-x` for the package's offline contract, capture, DOM, reader, and intent tests.

Enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, and load `packages/extension/dist` as an unpacked extension.

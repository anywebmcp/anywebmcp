# X WebMCP package

This package exposes WebMCP tools on `x.com` and `twitter.com`:

- `x_get_api_status` reports captured GraphQL operations and readiness.
- `x_get_posts` returns the posts shown on the current page.
- `x_create_post` publishes a text post.

## Reading posts

`x_get_posts` queries `article[data-testid="tweet"]` cards and extracts each post's permalink, author, text, timestamp, engagement metrics, media, link previews, quoted post, and repost attribution. It does not scroll, so it returns the timeline window X keeps in the DOM.

The adapter uses X's `tweet`, `tweetText`, `User-Name`, `tweetPhoto`, `card.wrapper`, `socialContext`, `reply`, `retweet`, and `like` test IDs. It identifies quoted posts from their nested link container. X may change these selectors without notice.

Top-level and quoted posts use the same recursive post shape. Image attachments include their rendered URL and alt text. Video and GIF attachments include a portable source URL when X exposes one and a preview image otherwise. Image collection is limited to X media and video-thumbnail assets so avatars and emoji are excluded. X often exposes playback through session-only `blob:` URLs, which the tool omits. Compact quoted cards may not expose identity, timestamp, or metrics, so those fields are `null`.

## Network capture

The package patches `fetch` at `document_start` to observe X's GraphQL operations and transaction IDs. `x_get_api_status` exposes this diagnostic state.

## Posting

The adapter was inspected on 2026-08-27 against X client bundle `main.dd01e8d41baf20e2a.js`.

X's in-page `sendTweet` function calls this persisted GraphQL mutation:

```text
POST /i/api/graphql/{queryId}/CreateTweet
```

The inspected bundle declares query ID `WXTdKnLddrQOunD6MhWi3g`. The adapter extracts the current value from the active `main.*.js` bundle because X can rotate it.

The text-only request body has this shape:

```json
{
  "variables": {
    "tweet_text": "...",
    "media": {
      "media_entities": [],
      "possibly_sensitive": false
    },
    "semantic_annotation_ids": [],
    "disallowed_reply_options": null
  },
  "features": {},
  "queryId": "..."
}
```

The request uses these headers:

- X's public web bearer token from the active bundle.
- `x-csrf-token` from the signed-in session's `ct0` cookie.
- `x-twitter-auth-type: OAuth2Session`.
- `x-twitter-active-user: yes`.
- `x-client-transaction-id` from X's transaction-ID module.

The request attaches cookies with `fetch(..., { credentials: "include" })`. Tools do not return authentication cookies.

### Internal modules

The inspected bundle uses these modules:

- Module `949428` contains `sendTweet` and its `CreateTweet` variable builder.
- Module `795387` contains the `CreateTweet` operation descriptor.
- Module `991160` loads X's transaction-ID generator.

Webpack module numbers and persisted query IDs can rotate. The extension finds the operation and transaction module from bundle signatures.

## Support and account risk

X does not support this web-client API. X's [automation rules](https://help.x.com/en/rules-and-policies/x-automation) prohibit non-API website scripting and warn that it may result in account suspension. The [official X API](https://docs.x.com/x-api/getting-started/about-x-api) supports production integrations through application OAuth.

## Local testing

Enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, and load `packages/extension/dist` as an unpacked extension.

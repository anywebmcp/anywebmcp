# X internal web API findings

Inspected on 2026-08-27 against X client bundle `main.dd01e8d41baf20e2a.js`.

## Posting

X's in-page `sendTweet` function calls a persisted GraphQL mutation:

```text
POST /i/api/graphql/{queryId}/CreateTweet
```

The inspected bundle currently declares query ID `WXTdKnLddrQOunD6MhWi3g`. This value is not stable, so the adapter extracts it from the active `main.*.js` bundle rather than storing it as a constant.

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

The important request headers are:

- X's public web bearer token, extracted from the active bundle.
- `x-csrf-token`, copied from the signed-in session's `ct0` cookie.
- `x-twitter-auth-type: OAuth2Session`.
- `x-twitter-active-user: yes`.
- `x-client-transaction-id`, produced by X's own transaction-ID module.

Cookies are attached by `fetch(..., { credentials: "include" })`; they are not returned through WebMCP.

## Reading

X does not expose a stable worker function for reading the currently loaded timeline. The adapter installs a transparent `fetch` wrapper at `document_start`, clones X GraphQL responses, and extracts tweet results from their JSON. `x_read_posts` therefore reads the same structured data X has already fetched without querying UI elements.

## Internal modules

In the inspected bundle:

- Module `949428` contains `sendTweet` and its `CreateTweet` variable builder.
- Module `795387` contains the current `CreateTweet` operation descriptor.
- Module `991160` loads X's transaction-ID generator.

Webpack module numbers and persisted query IDs are implementation details and can rotate. The extension discovers the operation and transaction module by their bundle signatures.

## Support and account risk

This is an unsupported web-client API. X's [automation rules](https://help.x.com/en/rules-and-policies/x-automation) prohibit non-API website scripting and warn that it may result in account suspension. The supported alternative is the [official X API](https://docs.x.com/x-api/getting-started/about-x-api), authenticated with an application OAuth token.

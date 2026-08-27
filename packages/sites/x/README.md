# X WebMCP package

This package exposes API-backed WebMCP tools on `x.com` and `twitter.com`:

- `x_get_api_status` reports captured GraphQL operations and readiness.
- `x_read_posts` returns structured posts captured from X's GraphQL responses.
- `x_create_post` publishes through X's `CreateTweet` GraphQL mutation.

The package patches `fetch` at `document_start` to passively observe X's own GraphQL responses. It discovers the current `CreateTweet` query ID and public bearer token from X's loaded client bundle, reads feature values from X's runtime configuration, and uses X's transaction-ID generator. Authentication cookies remain in the browser and are never returned by a tool.

This is an unsupported internal API. X rotates persisted query IDs and may change its request format without notice. X's automation rules also prohibit non-API website scripting, so using `x_create_post` may put the signed-in account at risk. For a supported production integration, use the official X API with OAuth instead.

For local native WebMCP testing, enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome before loading `packages/extension/dist` as an unpacked extension.

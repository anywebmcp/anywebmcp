# Hacker News WebMCP package

This package exposes read-only market-research tools on `news.ycombinator.com`:

- `hackernews_market_digest` finds explicit product-launch stories and returns transparent engagement metrics with bounded comment previews.
- `hackernews_research_topic` searches stories and comments for a topic and optional synonyms, then returns source-linked evidence, ranked threads, launches, problem discussions, sampled activity, and per-query coverage.
- `hackernews_read_thread` returns a bounded structured discussion in HN order or with the largest top-level branches first.

The adapter reads public data from the official [Hacker News Firebase API](https://github.com/HackerNews/API) and the public [HN Search API](https://hn.algolia.com/api). Hacker News serves pages with `default-src 'self'`, so direct cross-origin requests from the page's main JavaScript world are blocked by Content Security Policy. In browser builds, the site tools therefore send narrowly typed Algolia-search, Algolia-item, and Firebase-item operations through the extension's isolated content-script bridge. The Manifest V3 background worker validates the Hacker News sender and parameters, constructs the allowlisted API URL itself, and performs the request without credentials.

The bridge is not a generic fetch proxy: page scripts cannot provide URLs, headers, credentials, or request methods. Unknown operations, extra parameters, non-Hacker-News senders, oversized responses, invalid data, and expired requests are rejected. Requests are bounded to 20 seconds and 20 MiB, Algolia search pages return at most 100 hits, and the tools retain their existing input and result limits. Transport failures distinguish missing extension wiring, rejected requests, blocked or unreachable network requests, timeouts, HTTP failures, and malformed responses without exposing private browser diagnostics.

The adapter never reads cookies, requires no credentials, and does not vote, favorite, reply, or submit. Node tests and the API live-smoke harness inject an equivalent direct-fetch transport; the native browser entrypoint always installs the extension-mediated transport. The background worker wraps `fetch`, `setTimeout`, and `clearTimeout` at the worker scope so Chromium receives the native Web API receiver it requires.

## Interpretation boundaries

Hacker News is a technically skewed community, so activity is an interest signal rather than a market-size estimate. Search synonyms can overlap. `hackernews_research_topic` therefore reports exact result totals separately for every query/type pair and labels aggregate activity and unique-author counts as properties of the retrieved deduplicated sample.

Launch classification is deliberately conservative and title-based. It recognizes explicit Show HN, Launch HN, release, launch, announcement, and open-sourcing language. The digest reports its selection and ranking formulas in every result.

All returned story and comment text is untrusted web content and includes source permalinks for verification.

## Verification

Run deterministic logic tests with:

```sh
npm test -w @anywebmcp/site-hackernews
```

The offline suite also mounts the package through the shared WebMCP contract harness and uses deterministic API fixtures for successful reads, HTTP failures, malformed responses, missing items, operation and parameter validation, timeout handling, transport availability, and concurrent request/response correlation across the page bridge.

Run the JavaScript WebMCP API live-smoke harness with:

```sh
npm run test:live -w @anywebmcp/site-hackernews
```

The live harness executes the extension's real Hacker News entrypoint, captures tools registered through `document.modelContext.registerTool`, invokes every registered tool through its public `execute` contract, validates the JSON result shapes, and reads current data from the public Hacker News APIs. It injects the direct-fetch transport, so it does not verify the content-script bridge or background worker. Verify that browser-only path separately by opening `https://news.ycombinator.com/` with the built extension and completing a read-only call to each registered tool before benchmarking.

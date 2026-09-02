# Product Hunt WebMCP package

This package exposes read-only WebMCP tools on `www.producthunt.com` and `producthunt.com`:

- `producthunt_list_launches` lists launch cards currently rendered in the page's main content.
- `producthunt_read_product` reads the product profile and featured launch on the current product page.
- `producthunt_list_comments` lists the current launch's rendered comments as a flat reply tree.
- `producthunt_search_products` fetches and parses one public Product Hunt search-results page without navigating the current tab.

`producthunt_list_launches` returns each launch's rank, name, Product Hunt launch URL, tagline, topics, comment count, upvote count, image URL, and page section. When Product Hunt exposes the launch slug in its server-rendered hydration, the URL includes `?launch=<post-slug>` so multi-launch products open the matching discussion. On the homepage, callers can filter the `today`, `yesterday`, `last_week`, and `last_month` sections. On leaderboard pages, use the default `all` filter.

`producthunt_read_product` returns the product's name, tagline, description, logo, website, categories, rating, review/follower/launch counts, and the featured launch's description, topics, team, rank, points, and loaded-comment count. It expects the browser to already be on a `/products/<slug>` page.

`producthunt_list_comments` expects the current product page to contain a launch discussion. It returns comment IDs, `parentId`, reply depth, author identity, body text, maker/pinned/verified state, upvotes, timestamps, and the visible neighboring pagination URLs. It never expands collapsed threads or changes pages.

`producthunt_search_products` accepts a query, page number, and limit. It performs one same-origin `GET /search?q=...&page=...` using the current browser session and reads Product Hunt's server-rendered Apollo hydration payload. The search response is capped at 2 MB and the request at 15 seconds.

The adapter does not navigate, scroll, click, vote, comment, or modify Product Hunt. Homepage launch cards are read only from direct children of Product Hunt's explicit homepage section containers; promotional, recommended, testimonial, and historical insertions nested in `article` elements do not affect section membership or rank. Leaderboard cards nested in promotional `article` elements are likewise excluded. Launches without a displayed rank, such as the current-day list, use their filtered visible page order. Returned product names, descriptions, comments, taglines, topics, and URLs are marked as untrusted content.

The official Product Hunt API requires a separately provisioned access token, so these tools follow the normal signed-out or signed-in website UI instead. The DOM readers rely on Product Hunt's current semantic paths and `data-test` attributes. Launch URL resolution and search additionally rely on Product Hunt's server-rendered `ApolloSSRDataTransport` data. Product and comment readers allow up to 1.5 seconds for a requested launch block to finish streaming after navigation. These assumptions may require maintenance when Product Hunt changes its frontend.

Run the package's offline contract and fixture tests with `npm test -w @anywebmcp/site-producthunt`.

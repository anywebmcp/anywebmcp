# Temu WebMCP package

This package exposes read-only WebMCP tools on `www.temu.com`:

- `temu_search_products` reads a bounded set of product cards from the current search-results page. If `query` differs from the open page, it first tries a normal same-origin HTML request with the current browser session.
- `temu_read_product` reads a known product from the current product page or a same-origin HTML request and reports whether the result contains detail-level or summary-level data.
- `temu_compare_products` normalizes two to eight known products and highlights the lowest displayed price only when all compared prices use one currency.

Tools follow the [shared result contract](../../../docs/tool-result-contract.md). Successful calls return `status: "completed"` with their payload under `data`. If a search or product page must render interactively before collection, the corresponding tool returns `status: "navigation_required"` with the destination URL and exact resume instruction. Authentication and security-verification blockers return `status: "failed"` with a recovery message.

The adapter prefers the rendered public DOM and public structured data such as JSON-LD and hydration payloads. Its implementation keeps live-page collection and scrolling, same-origin HTML fetching, structured-data traversal, detail extraction, and comparison/registry behavior in separate Temu-local modules. It does not use a seller API, require API credentials, call an unsupported private endpoint, modify the cart, or begin checkout. Search collection is capped at 50 products and eight scrolls; the original position is restored by default. Structured-data traversal is bounded by script size, tree depth, collection width, and visited values. Comparison fetches at most two product pages concurrently, and the in-page product registry retains at most 300 recently observed summaries.

Temu prices and availability are locale-, account-, promotion-, and SKU-dependent. The package therefore distinguishes `displayedPrice` from structured variant prices, attaches `observedAt`, reports missing SKU data through `warnings`, and never invents an effective checkout price. A product-page result can be `summary` when Temu does not expose detail data in HTML. Fetched detail HTML is accepted only when both its final URL and extracted product data identify the requested product; homepage shells, redirects, and mismatched product pages are not reported as completed product reads. When available, a known search snapshot is returned instead.

Temu may present an interactive security verification or redirect an unauthenticated session to its login page. The tools return `SECURITY_VERIFICATION_REQUIRED` or `AUTHENTICATION_REQUIRED` respectively; they do not attempt to solve, bypass, or enter credentials. Product titles, descriptions, seller names, and marketplace metadata are marked as untrusted content.

Selectors and embedded-data keys are deliberately broad because Temu's generated class names and page payloads may change. Re-run the package tests and the manual benchmarks after material frontend changes.

Run the offline package tests with:

```sh
npm test -w @anywebmcp/site-temu
```

The suite covers parsing and result adaptation, all three mounted tool contracts, and sanitized search-results and product-detail fixtures. Run `npm test`, `npm run typecheck`, and `npm run validate:sites` from the repository root before submitting changes. Because this refactor does not materially change tool behavior, it does not require benchmark backfill.

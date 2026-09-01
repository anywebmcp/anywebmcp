# eBay WebMCP benchmarks

## Direct JavaScript verification — 2026-09-01

The production eBay DOM module and the complete site package were bundled into temporary browser scripts and invoked directly without WebMCP registration or calls.

The first public eBay run completed successfully:

- `ebay_search_items` returned five filtered listings with canonical item IDs, prices, shipping, calculated totals, seller feedback, and watch state.
- `ebay_read_item` read the first returned item and extracted its schema.org offer plus 15 visible item specifics.
- `ebay_read_items` read three real items with three successes and no failures.

Repeated automated page loads triggered eBay's security challenge. Verification caught and fixed the false-empty behavior: the current implementation returns an explicit failure rather than an empty successful search. The run also caught and fixed encoded JSON-LD titles, an overly broad seller-link fallback, schema condition normalization, and an unhelpful signed-out watchlist fetch failure.

All five current `execute()` handlers were then invoked directly from the production site bundle against deterministic eBay-shaped responses. Search returned three items, single-item read returned normalized title, condition, seller, and specifics, batch read succeeded for all three items, watchlist read returned one item, and watch-state add/remove both verified their final state. The fixture was restored to its original unwatched state. No real watchlist was changed.

`npm test` (four tests), strict TypeScript checking, `npm run build`, and `git diff --check` passed on the branch rebased onto the latest `origin/main`.

## Pending comparative benchmark

A WebMCP-versus-browser benchmark has not been recorded yet. The package requires a rebuilt WebMCP-enabled Codex launcher, and the watchlist cases additionally require a controlled signed-in eBay test account. No timing or token values are claimed here.

Before release, run each case three times in alternating order with and without WebMCP, using the same model and starting page:

1. Search for a used ThinkPad X1 Carbon with a maximum price and lowest-total-price sorting.
2. Extract condition, price, seller feedback, returns, and item specifics from one known item.
3. Compare five known items.
4. Read a controlled account's watchlist.
5. Add and then remove a controlled test item from that watchlist.

Record the date, model, environment, per-run elapsed time, and input/output tokens, then replace this section with the required median summary table.

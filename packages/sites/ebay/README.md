# eBay WebMCP package

This package exposes session-backed WebMCP tools on major regional eBay sites:

- `ebay_search_items` performs a bounded search without navigating the current tab.
- `ebay_read_item` reads one item by item ID or URL.
- `ebay_read_items` reads up to 10 items in bounded batches for comparison.
- `ebay_get_watchlist` reads the signed-in user's watchlist.
- `ebay_set_watch_state` adds or removes a mounted item through eBay's visible UI and verifies the resulting state.

Read operations use same-origin `GET` requests with the current browser session. Search results prefer the stable `data-listingid` attribute and item pages prefer eBay's schema.org `Product` and `Offer` data, with visible DOM fields as fallbacks. Authentication cookies are never returned by a tool.

Watchlist mutation deliberately requires the item to be mounted in the current item or search page. It clicks the normal eBay watch control and does not call `WatchListAdd`, `WatchListRemove`, or another internal mutation endpoint directly. It refuses to click when the current state is ambiguous, when the user is signed out, or when the item is not mounted.

The integration currently supports `ebay.com`, `ebay.co.uk`, `ebay.de`, `ebay.fr`, `ebay.it`, `ebay.es`, `ebay.ca`, and `ebay.com.au`. Item URLs passed to read tools must use the same regional origin as the open tab. Text-based shipping, returns, seller, and watch-state fallbacks depend on eBay's current English UI; schema.org item fields and search card attributes are less locale-sensitive.

Returned listing and seller content is marked as untrusted. Search is capped at 50 results, item comparison at 10 items with concurrency three, and watchlist reading at 50 results. The package never bids, makes offers, adds items to the cart, buys items, or publishes listings.

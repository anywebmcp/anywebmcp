# Amazon WebMCP package

This package exposes one read-only WebMCP tool on supported Amazon marketplaces:

- `amazon_search_products` performs a product search and returns structured product cards without navigating the current page.

The first iteration intentionally does not expose product details, reviews, cart operations, checkout, orders, or Seller Central.

The tool follows the [shared result contract](../../../docs/tool-result-contract.md). Successful calls return `status: "completed"` with search data, while request, HTTP, bot-check, and input failures return `status: "failed"` with a diagnostic message. The common wrapper handles WebMCP response formatting.

## Supported marketplaces

The package runs on the `www` host for Amazon marketplaces in the United States, Canada, Mexico, Brazil, United Kingdom, Ireland, Germany, France, Italy, Spain, Netherlands, Sweden, Poland, Belgium, Japan, India, Australia, Singapore, United Arab Emirates, Saudi Arabia, Turkey, Egypt, and South Africa.

The search uses the marketplace of the current Amazon tab. Sign-in is not required. Existing browser cookies are included so Amazon can apply the tab's language, currency, and delivery-region preferences.

## Implementation

Amazon's Product Advertising API requires separate credentials and therefore does not fit OpenWebMCP's current-session requirement. The tool instead requests Amazon's normal `/s?k=...` browser search page on the current origin and parses the returned HTML with `DOMParser`.

Product cards are selected using `[data-component-type="s-search-result"][data-asin]`. Fields use Amazon's semantic `data-cy` and `data-component-type` attributes first, with established class selectors as fallbacks. Links returned by the tool are canonical `/dp/<ASIN>` URLs rather than advertising or ranking-tracking links.

Amazon can vary the HTML by marketplace, experiment, viewport, and bot checks. Missing fields are returned as `null`. If Amazon returns a CAPTCHA or robot-check page, the tool returns a `bot_check` error and does not attempt to bypass it.

## Tool input

```json
{
  "query": "usb c hub",
  "limit": 10,
  "page": 1
}
```

- `query` is required and limited to 200 characters.
- `limit` is optional, defaults to 10, and is capped at 20.
- `page` is optional, defaults to 1, and is capped at 10.

All product titles and other text returned from Amazon must be treated as untrusted content.

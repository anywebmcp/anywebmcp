# Amazon WebMCP package

This package exposes six read-only WebMCP tools on supported Amazon marketplaces:

- `amazon_search_products` searches the current marketplace and returns structured product cards.
- `amazon_get_product` returns product details, variants, current purchase terms, features, and specifications.
- `amazon_get_buying_options` compares new and used offers from Amazon and third-party sellers.
- `amazon_read_reviews` reads and filters the full reviews embedded on a product page.
- `amazon_get_review_summary` returns Amazon's review insights, recurring concerns, and variant evidence.
- `amazon_compare_products` compares 2 to 5 ASINs in a normalized specification and purchase-terms table.

All tools are read-only, keep the current tab in place, and follow the [shared result contract](../../../docs/tool-result-contract.md). Successful calls return `status: "completed"`; validation, HTTP, bot-check, and parsing failures return `status: "failed"`. Product, seller, and review text returned by Amazon is untrusted.

## Supported marketplaces

The package runs on the `www` host for Amazon marketplaces in the United States, Canada, Mexico, Brazil, United Kingdom, Ireland, Germany, France, Italy, Spain, Netherlands, Sweden, Poland, Belgium, Japan, India, Australia, Singapore, United Arab Emirates, Saudi Arabia, Turkey, Egypt, and South Africa.

Requests use the marketplace of the current Amazon tab. Existing browser cookies are included, so Amazon can apply the session's language, currency, location, and delivery-region preferences. Sign-in is not required for the normal product-research flow.

## Implementation and selectors

Amazon's Product Advertising API requires separate credentials and therefore does not fit AnyWeb MCP's current-session requirement. These tools request Amazon's normal same-origin browser pages and parse returned HTML with `DOMParser`:

- Search uses `/s?k=...` and product cards matching `[data-component-type="s-search-result"][data-asin]`.
- Product details use `/dp/<ASIN>`, with stable IDs such as `#productTitle`, `#feature-bullets`, `#availability`, the buy-box delivery and seller feature blocks, product detail tables, and `data-asin` variation controls.
- Buying options use `/gp/offer-listing/<ASIN>?condition=ALL`, which Amazon currently redirects to the normal product page with its all-offers display. Offers use `#aod-pinned-offer` and repeated `#aod-offer` blocks.
- Reviews use the `[data-hook="review"]` blocks embedded on `/dp/<ASIN>`. Review insights use Amazon's `data-testid` attributes for the overall summary, aspects, and mention counts.

Returned links are canonical product or review links rather than advertising/ranking links. Missing optional fields are returned as `null` or an empty collection. Amazon can vary its HTML by marketplace, experiment, viewport, location, and product type; selector assumptions should be retested when the site changes materially.

If Amazon returns a CAPTCHA or robot-check page, the tool returns a `bot_check` failure and never attempts to bypass it.

## Important limitations

- Price, availability, seller, delivery, returns, and offer ordering are snapshots for the current session and can change. Buying-option `estimatedTotal` includes displayed item price and shipping only; taxes, import charges, coupons, and location-dependent charges may be added later.
- On Amazon.com, navigating directly to the complete product-reviews page can require sign-in. To preserve the unauthenticated first iteration, `amazon_read_reviews` filters and sorts the full review texts embedded on the product page. This is a bounded sample, not the complete review corpus. `recent` and `helpful` reorder only that sample.
- `amazon_get_review_summary` returns Amazon's own displayed narrative and aspect summaries when available. It does not synthesize a replacement narrative when Amazon provides none. Variant differences are calculated only from embedded reviews that name a variant and are returned only when at least two variants are represented.
- `amazon_compare_products` normalizes specification labels present in each requested product page. Amazon may omit a specification for one product or use marketplace-specific wording.

## Input examples

```json
{ "query": "usb c hub", "limit": 10, "page": 1 }
```

```json
{ "asin": "B0BR3M8XHK" }
```

```json
{
  "asin": "B0BR3M8XHK",
  "rating": 4,
  "query": "durability",
  "sort": "helpful",
  "limit": 10
}
```

```json
{ "asins": ["B0BR3M8XHK", "B0D2X2VQY7"] }
```

## Tests

Run the Amazon package's offline contract and sanitized fixture tests from the repository root:

```sh
npm test -w @anywebmcp/site-amazon
```

The root `npm test` command also includes this package. No Amazon credentials or live requests are used.

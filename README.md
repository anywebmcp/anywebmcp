# AnyWeb MCP

AnyWeb MCP is a Chrome extension that adds WebMCP tools to supported websites. It currently includes adapters for Amazon, eBay, Hacker News, LinkedIn, Product Hunt, Reddit, Temu, and X.

## Build

```sh
npm install
npm run build
```

The unpacked extension is generated at `packages/extension/dist`.

## Release

Create the manual extension ZIP, Chrome Web Store ZIP, and signed/notarized macOS Codex launcher ZIP with one command:

```sh
npm run release
```

The command prompts for a patch, minor, major, or exact version. For a non-interactive release, pass `--bump=patch|minor|major` or `--version=x.y.z`. Production releases require a clean worktree and the Apple setup described below. Artifacts are written to `dist/releases/<version>`:

```text
anywebmcp-extension-<version>.zip
anywebmcp-chrome-web-store-<version>.zip
codex-webmcp-macos-universal-<version>.zip
```

The manual archive expands to a versioned extension directory. The Chrome Web Store archive has `manifest.json` at its root. Both contain the same extension build, and the launcher embeds that exact build. Use `npm run release -- --version=x.y.z --local` to verify the complete pipeline with an ad-hoc-signed launcher; local output is not suitable for distribution.

After committing the version change, tag and publish the three production ZIPs as GitHub Release assets:

```sh
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 dist/releases/0.2.0/*.zip --verify-tag --generate-notes
```

## Validate site metadata

Validate every canonical site declaration and its repository wiring with:

```sh
npm run validate:sites
```

See [Site metadata](docs/site-metadata.md) for schema ownership and validation rules.

## Develop with Codex WebMCP

On macOS, install a Codex launcher that loads the extension from this checkout:

```sh
npm run codex:install
```

For later development sessions, rebuild the extension, refresh the launcher, and open it with:

```sh
npm run codex:dev
```

Quit Codex WebMCP before reopening it when extension code changes. The development launcher is installed at `~/Applications/Codex WebMCP.app` and keeps a profile separate from normal Codex.

To develop against the standard Codex login and browser data, quit normal Codex and run `npm run codex:dev:standard`.

To generate a Developer ID signed and notarized production launcher with the extension embedded:

```sh
npm run codex:release
```

First complete the [Apple certificate and notarization setup](packages/codex-launcher/README.md#one-time-apple-setup). The command writes the signed app and a ZIP containing Apple's stapled notarization ticket to `packages/codex-launcher/dist`, so recipients should not need the macOS “Open Anyway” workaround. A normal first-open confirmation may still appear. Production builds use the standard Codex profile, so normal Codex must be closed before launching them. Building requires Node.js and Apple's Command Line Tools; the receiving Mac only needs macOS and Codex installed. For a local ad-hoc build without Apple credentials, use `npm run codex:build`.

## Load in Chrome

1. Open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch Chrome.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `packages/extension/dist`.
4. Open or reload a supported site such as `https://news.ycombinator.com`, `https://www.temu.com`, or `https://x.com`.

The same extension registers Amazon tools on supported `www.amazon.*` marketplaces, eBay tools on supported regional eBay sites, Hacker News tools on `https://news.ycombinator.com`, LinkedIn tools on `https://www.linkedin.com`, Product Hunt tools on `https://www.producthunt.com`, Reddit tools on `https://www.reddit.com` and `https://old.reddit.com`, and Temu tools on `https://www.temu.com`. Reload an existing tab after installing or rebuilding the extension. Reddit may require the user to complete a human-verification challenge before tools can access page content.

## Amazon tools

- `amazon_search_products`
- `amazon_get_product`
- `amazon_get_buying_options`
- `amazon_read_reviews`
- `amazon_get_review_summary`
- `amazon_compare_products`

The Amazon adapter performs read-only product search and research on the current marketplace. The normal flow does not require sign-in and exposes no cart operations. See [the Amazon package](packages/sites/amazon/README.md) for supported marketplaces, returned fields, and current limitations.

## eBay tools

- `ebay_search_items`
- `ebay_read_item`
- `ebay_read_items`
- `ebay_get_watchlist`
- `ebay_set_watch_state`

The eBay adapter uses the current regional eBay session for same-origin, read-only search and item requests. Watchlist changes use a mounted eBay UI control and verify its resulting state; the adapter never bids, buys, adds to cart, or makes offers. See [the eBay package](packages/sites/ebay/README.md) for supported regional sites and implementation details.

## Hacker News tools

- `hackernews_market_digest`
- `hackernews_research_topic`
- `hackernews_read_thread`

The Hacker News adapter is fully read-only. It builds bounded, source-linked launch and topic-research evidence from the public HN APIs without treating community activity as a market-size estimate. See [the Hacker News package](packages/sites/hackernews/README.md) for methodology and interpretation boundaries.

## X tools

- `x_get_api_status`
- `x_get_posts`
- `x_create_post`
- `x_reply_to_post`

`x_create_post` and `x_reply_to_post` return prefilled intent URLs. The caller opens the URL, and the user reviews and submits the post or reply manually in X. Neither tool publishes or clicks a submit button.

See [the system overview](docs/system-overview.md) and [the X package](packages/sites/x/README.md) for extension details. See [the launcher package](packages/codex-launcher/README.md) for app packaging.

## LinkedIn tools

- `linkedin_list_loaded_posts`
- `linkedin_collect_feed_posts`
- `linkedin_read_post`
- `linkedin_ensure_post`
- `linkedin_prepare_comment_draft`

The LinkedIn adapter reads the current feed through the page DOM. Collection and recovery scrolling are bounded. Comment drafting only inserts and verifies text in the visible editor; it never submits the comment. See [the LinkedIn package](packages/sites/linkedin/README.md) for details.

## Product Hunt tools

- `producthunt_list_launches`
- `producthunt_read_product`
- `producthunt_list_comments`
- `producthunt_search_products`

The Product Hunt adapter reads launches, product details, and comments from the page DOM, and searches products through Product Hunt's public search page without navigating the current tab. It never votes, comments, or modifies Product Hunt. See [the Product Hunt package](packages/sites/producthunt/README.md) for details.

## Temu tools

- `temu_search_products`
- `temu_read_product`
- `temu_compare_products`

The Temu adapter is read-only. It reads bounded search results and public product details, reports whether exact SKU data was available, and does not modify the cart or begin checkout. Interactive security verification is detected but never automated. See [the Temu package](packages/sites/temu/README.md) for details.

## Reddit tools

- `reddit_collect_listing`
- `reddit_read_thread`
- `reddit_get_community_rules`
- `reddit_prepare_reply_draft`

The Reddit adapter performs bounded reads of the current page and keeps page context inside every result instead of exposing a separate context tool. Reply drafting only inserts and verifies text in the visible editor; it never submits the reply. See [the Reddit package](packages/sites/reddit/README.md) for details.

## License

[Apache License 2.0](LICENSE)

Copyright 2026 UI Bakery Inc.

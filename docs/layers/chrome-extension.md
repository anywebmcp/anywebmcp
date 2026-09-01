# Chrome extension layer

`packages/extension` is the Manifest V3 extension loaded by Chrome. It contains a background service worker, an isolated bridge, and one main-world entry for each bundled site package.

The main-world entry can access `document.modelContext` and the website's page state. The isolated bridge will later mediate access to extension storage and background services without exposing secrets to page scripts.

## Loading flow

1. Chrome opens a supported domain.
2. The extension injects the matching bundled site entry.
3. The entry imports its side-effect-free site package.
4. The entry explicitly invokes the mount helper, which registers the package's WebMCP tools.
5. Registration is removed when the document is unloaded.

Unsupported domains receive no site entry.

## Packaging model

Initially, every executable site package is bundled into the extension at build time. The generated extension is written to `packages/extension/dist` and can be loaded through `chrome://extensions` using **Load unpacked**.

Manifest V3 does not allow a Chrome Web Store extension to fetch and execute remotely hosted JavaScript. A future API can remotely host data and invoke server-side operations, but executable browser logic must remain in the reviewed extension package. See [Chrome's remotely hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).

This leaves three viable ways to add or update integrations:

1. Publish a new extension version containing updated site packages.
2. Fetch non-executable configuration for logic already packaged in the extension.
3. Move appropriate operations behind a future API while keeping the browser adapter packaged.

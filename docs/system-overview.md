# System overview

OpenWebMCP adds WebMCP tools to supported websites through a Chrome extension. The repository separates the installable extension, shared code, and independently owned site packages.

## Components

### Chrome extension

`packages/extension` is the Manifest V3 extension loaded by Chrome. It contains a background service worker, an isolated bridge, and one main-world entry for each bundled site package.

The main-world entry can access `document.modelContext` and the website's page state. The isolated bridge will later mediate access to extension storage and background services without exposing secrets to page scripts.

### Site packages

`packages/sites/*` contains one package per supported website. A package owns:

- Domain match patterns.
- WebMCP tool definitions.
- Page context and selectors.
- UI, official API, or internal API adapters.

The initial X package lives at `packages/sites/x`. It captures X's GraphQL responses for structured reads and can publish through the signed-in web client's `CreateTweet` mutation without interacting with X's DOM.

### Common package

`packages/common` contains shared TypeScript contracts and the small browser-side helpers that register packaged site tools with `document.modelContext` and manage their lifecycle.

### Codex launcher package

`packages/codex-launcher` generates a macOS launcher that starts a locally installed Codex runtime with WebMCP testing enabled. Development launchers reference an external unpacked extension directory. Distributable launchers copy the extension into the generated app bundle and do not require Node.js at runtime.

The generated launcher never contains a committed Codex binary. On the recipient's machine it creates a signed local runtime copy from `/Applications/ChatGPT.app` and uses a separate browser profile.

## Loading flow

1. Chrome opens a supported domain.
2. The extension injects the matching bundled site entry.
3. The entry imports its site package.
4. The common registration helper registers the package's WebMCP tools.
5. Registration is removed when the document is unloaded.

Unsupported domains receive no site entry.

## Packaging model

Initially, every executable site package is bundled into the extension at build time. The generated extension is written to `packages/extension/dist` and can be loaded through `chrome://extensions` using **Load unpacked**.

Manifest V3 does not allow a Chrome Web Store extension to fetch and execute remotely hosted JavaScript. A future API can remotely host data and invoke server-side operations, but executable browser logic must remain in the reviewed extension package. See [Chrome's remotely hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).

This leaves three viable ways to add or update integrations:

1. Publish a new extension version containing updated site packages.
2. Fetch non-executable configuration for logic already packaged in the extension.
3. Move appropriate operations behind a future API while keeping the browser adapter packaged.

## Repository layout

```text
packages/
  codex-launcher/ macOS development and distribution launcher generator
  extension/    Chrome extension
  common/       Shared types and registration helpers
  sites/        Per-domain packages
docs/
  system-overview.md
```

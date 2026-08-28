# OpenWebMCP

OpenWebMCP is a Chrome extension that adds WebMCP tools to supported websites. It currently includes adapters for X and LinkedIn.

## Build

```sh
npm install
npm run build
```

The unpacked extension is generated at `packages/extension/dist`.

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

To generate a distributable launcher with the extension embedded:

```sh
npm run codex:build
```

The generated app and a transfer-safe ZIP are written to `packages/codex-launcher/dist`. Production builds use the standard Codex profile, so normal Codex must be closed before launching them. Node.js is required to build the artifacts, but not to run the app. The receiving Mac still needs Codex installed. Ad-hoc builds transferred through a browser or messenger require quarantine removal by the recipient; frictionless distribution requires Developer ID signing and notarization. See [the launcher package](packages/codex-launcher/README.md) for details.

## Load in Chrome

1. Open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch Chrome.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `packages/extension/dist`.
4. Open or reload `https://x.com`.

The same extension registers LinkedIn tools on `https://www.linkedin.com`. Reload an existing LinkedIn tab after installing or rebuilding the extension.

## X tools

- `x_get_api_status`
- `x_read_posts`
- `x_create_post`

`x_create_post` publishes immediately through X's internal web GraphQL API and should only be invoked after the user confirms the exact text.

See [the system overview](docs/system-overview.md), [X internal API findings](docs/x-internal-api.md), [the X package](packages/sites/x/README.md), and [the launcher package](packages/codex-launcher/README.md) for implementation details.

## LinkedIn tools

- `linkedin_list_loaded_posts`
- `linkedin_collect_feed_posts`
- `linkedin_read_post`
- `linkedin_ensure_post`
- `linkedin_prepare_comment_draft`

The LinkedIn adapter reads the current feed through the page DOM. Collection and recovery scrolling are bounded. Comment drafting only inserts and verifies text in the visible editor; it never submits the comment. See [the LinkedIn package](packages/sites/linkedin/README.md) for details.

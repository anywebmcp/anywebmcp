# OpenWebMCP

OpenWebMCP is a Chrome extension that adds WebMCP tools to supported websites. The first adapter targets X.

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

The generated app and a transfer-safe ZIP are written to `packages/codex-launcher/dist`. Node.js is required to build them, but not to run the app. The receiving Mac still needs Codex installed. See [the launcher package](packages/codex-launcher/README.md) for options and macOS signing notes.

## Load in Chrome

1. Open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch Chrome.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `packages/extension/dist`.
4. Open or reload `https://x.com`.

## X tools

- `x_get_api_status`
- `x_read_posts`
- `x_create_post`

`x_create_post` publishes immediately through X's internal web GraphQL API and should only be invoked after the user confirms the exact text.

See [the system overview](docs/system-overview.md), [X internal API findings](docs/x-internal-api.md), [the X package](packages/sites/x/README.md), and [the launcher package](packages/codex-launcher/README.md) for implementation details.

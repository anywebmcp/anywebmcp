# OpenWebMCP

OpenWebMCP is a Chrome extension that adds WebMCP tools to supported websites. The first adapter targets X.

## Build

```sh
npm install
npm run build
```

The unpacked extension is generated at `packages/extension/dist`.

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

See [the system overview](docs/system-overview.md), [X internal API findings](docs/x-internal-api.md), and [the X package](packages/sites/x/README.md) for implementation details.

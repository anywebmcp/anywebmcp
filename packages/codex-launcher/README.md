# Codex WebMCP launcher

This macOS-only package generates a small launcher app that starts a locally installed Codex app with an unpacked WebMCP extension.

The generator uses Node.js. The generated `.app` does not: it runs with `zsh` and standard macOS utilities. Codex itself must be installed at `/Applications/ChatGPT.app` unless another location is supplied.

## Development launcher

The development launcher references the extension build in the current checkout:

```sh
npm run codex:install
```

Rebuild the extension and reinstall/open the launcher with:

```sh
npm run codex:dev
```

Quit Codex WebMCP before reopening it when extension code changes.

Development mode keeps its browser data isolated at `~/Library/Application Support/Codex-WebMCP/Profile`, so it can run alongside the standard Codex app.

## Distributable launcher

Generate a self-contained launcher with the extension copied into the app bundle:

```sh
npm run codex:build
```

The command writes `Codex WebMCP.app` and a transfer-safe `Codex WebMCP.zip` to `packages/codex-launcher/dist`. Send the ZIP so the executable bit and app bundle are preserved. The recipient does not need Node.js to run it, but does need macOS and Codex installed.

The distributable launcher uses the standard Codex user-data directory at `~/Library/Application Support/Codex`, including its login, cookies, and preferences. Quit the standard Codex app before opening Codex WebMCP; two processes must not use this profile concurrently.

The generated app is ad-hoc signed, not Developer ID signed or notarized. Browsers and messengers such as Telegram add macOS quarantine metadata, so Gatekeeper will reject a transferred build. After verifying that the ZIP came from a trusted source, the recipient can remove quarantine and open it:

```sh
xattr -dr com.apple.quarantine "/path/to/Codex WebMCP.app"
open "/path/to/Codex WebMCP.app"
```

If any file inside the bundle was edited after generation, sign the app again before opening it:

```sh
codesign --force --sign - "/path/to/Codex WebMCP.app"
```

Frictionless distribution requires signing with an Apple Developer ID certificate and notarizing the app.

## Custom extension directory

```sh
npm run codex:install -- --extension-dir=../another-extension/dist
```

Run diagnostics with:

```sh
npm run codex:doctor
```

The launcher never modifies `/Applications/ChatGPT.app`. Both modes keep versioned runtime copies under `~/Library/Application Support/Codex-WebMCP/Runtime`; only development mode creates a separate browser profile there.

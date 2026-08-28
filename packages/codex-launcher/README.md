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

## Distributable launcher

Generate a self-contained launcher with the extension copied into the app bundle:

```sh
npm run codex:build
```

The command writes `Codex WebMCP.app` and a transfer-safe `Codex WebMCP.zip` to `packages/codex-launcher/dist`. Send the ZIP so the executable bit and app bundle are preserved. The recipient does not need Node.js to run it, but does need macOS and Codex installed. Because the generated app is ad-hoc signed rather than Developer ID signed and notarized, macOS may require an explicit first-open approval when it is transferred to another machine.

## Custom extension directory

```sh
npm run codex:install -- --extension-dir=../another-extension/dist
```

Run diagnostics with:

```sh
npm run codex:doctor
```

The launcher never modifies `/Applications/ChatGPT.app`. It keeps a versioned local runtime copy and a separate browser profile under `~/Library/Application Support/Codex-WebMCP`.

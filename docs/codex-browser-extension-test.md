# Codex browser extension launch test

Tested on 2026-08-28 with Codex desktop `26.820.60940` and its bundled Chromium `151.0.7922.170`.

## Setup

- Extension: `packages/extension/dist`
- Target: `https://x.com/`
- Isolated browser profile: a temporary directory under `/tmp`
- App isolation: an unchanged APFS copy of `/Applications/ChatGPT.app` under `/tmp`
- Chromium switches:
  - `--user-data-dir=<temporary-profile>`
  - `--load-extension=<repo>/packages/extension/dist`
  - `--enable-features=WebMCPTesting`
  - `--remote-debugging-port=0` for local inspection

Using only `CODEX_ELECTRON_USER_DATA_PATH` did not start a second instance; Codex forwarded the launch to the already-running app. Passing `--user-data-dir` directly was required for this packaged build.

## Installed launcher

A clickable launcher is installed at:

`/Users/vladimir/Applications/AnyWebMCP Codex Launcher.app`

The reproducible generator now lives at `packages/codex-launcher`. It supports a development mode that references an external extension directory and a bundle mode that embeds the extension for distribution. Generated launchers use only macOS system tools at runtime; Node.js is required only to generate them.

The launcher:

- reads the installed Codex version from `/Applications/ChatGPT.app`;
- creates an unchanged, signed APFS runtime copy at `/Users/vladimir/Library/Application Support/Codex-WebMCP/Runtime/ChatGPT-<version>-<build>.app` when that version is first launched;
- keeps browser state in `/Users/vladimir/Library/Application Support/Codex-WebMCP/Profile`;
- loads `packages/extension/dist`;
- enables `WebMCPTesting`;
- does not enable a remote-debugging port.

Versioned runtime copies allow AnyWebMCP Codex Launcher to run alongside the normal Codex app and avoid modifying the installed bundle. After Codex updates, the launcher creates a runtime copy for the new version. Old runtime versions can be moved to Trash once AnyWebMCP Codex Launcher is closed.

The installed launcher was opened successfully. Its main process received all three intended arguments, and its renderer process was marked as an extension process.

## Results

The isolated Codex process started successfully. Its process tree contained an extension renderer, and the extension service worker was available at:

`chrome-extension://gfmmpbppcokfeogaomnfheocfoiplamo/background.js`

On `x.com`:

- `document.modelContext` was available.
- `document.modelContext.getTools()` returned:
  - `x_create_post`
  - `x_get_api_status`
  - `x_read_posts`
- A read-only call to `x_get_api_status` succeeded and returned:

```json
{
  "capturedOperations": [],
  "capturedPostCount": 0,
  "hasTransactionId": false
}
```

The profile was not signed in to X, so the empty status is expected. No login was attempted, no post was created, and no write-capable WebMCP tool was invoked.

## Changes and cleanup

- No extension source or build output was changed.
- The installed `/Applications/ChatGPT.app` was not modified.
- Before the reusable launcher package was added, this document was the only repository change made by the original launch test.
- The launcher app and its application-support folder are user-level filesystem additions outside the repository. To uninstall them, quit AnyWebMCP Codex Launcher and move `/Users/vladimir/Applications/AnyWebMCP Codex Launcher.app` and `/Users/vladimir/Library/Application Support/Codex-WebMCP` to Trash.
- Browser data created by an earlier launcher smoke test was moved to Trash as `Codex-WebMCP-initial-profile-20260828` and remains recoverable until Trash is emptied.
- After verification, the temporary artifacts were moved to Trash and remain recoverable as `AnyWebMCP-Codex-Test-20260828.app` and `anywebmcp-codex-profile-20260828` until Trash is emptied.

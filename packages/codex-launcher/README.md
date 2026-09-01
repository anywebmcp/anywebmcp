# AnyWebMCP Codex Launcher

This macOS-only package generates a small launcher app that starts a locally installed Codex app with an unpacked WebMCP extension.

Building requires Node.js 20+ and Apple's Command Line Tools (`xcode-select --install`). The generated `.app` does not require Node.js or developer tools: a small universal native executable starts `zsh` and standard macOS utilities. It supports Apple silicon and Intel Macs running macOS 13+. Codex itself must be installed at `/Applications/ChatGPT.app` unless another location is supplied.

## Development launcher

The development launcher references the extension build in the current checkout:

```sh
npm run codex:install
```

Rebuild the extension and reinstall/open the launcher with:

```sh
npm run codex:dev
```

Quit AnyWebMCP Codex Launcher before reopening it when extension code changes.

Development mode keeps its browser data isolated at `~/Library/Application Support/Codex-WebMCP/Profile`, so it can run alongside the standard Codex app.

To load the development extension with the standard Codex login and browser data instead, first quit the standard Codex app, then run:

```sh
npm run codex:dev:standard
```

Extension mode and profile mode can also be selected independently with `--mode=dev|bundle` and `--profile=standard|isolated`.

## Signed production release

After the one-time Apple setup below, build a Developer ID signed and notarized launcher with the extension included:

```sh
npm run codex:release
```

The command signs the app with hardened runtime and a secure timestamp, submits a temporary ZIP to Apple, waits for acceptance, staples Apple's ticket to the app, and checks both its signature and Gatekeeper acceptance. It then creates the final `AnyWebMCP Codex Launcher.zip` from the stapled app. The app and ZIP are written to `packages/codex-launcher/dist`; send the ZIP to recipients. The launcher's bundle version is read from the embedded extension manifest. No Codex executable is uploaded or included in the release.

The release fails if signing or notarization fails; it never falls back to an ad-hoc signature. Existing output is kept until the new app passes notarization and verification. Apple submissions can take time; the command prints the submission ID and waits up to 30 minutes. If it times out, Apple continues processing. Inspect that submission with `xcrun notarytool info <id> --keychain-profile anywebmcp` and retrieve its log with `xcrun notarytool log <id> --keychain-profile anywebmcp`. A timed-out build does not produce a new release ZIP; rerun the release command after resolving the issue.

Recipients should not need **System Settings → Privacy & Security → Open Anyway** or quarantine removal. macOS can still display its normal first-open confirmation for an app downloaded from the internet. Do not edit the app after signing; rebuild and notarize it again instead.

The distributable launcher uses the standard Codex user-data directory at `~/Library/Application Support/Codex`, including its login, cookies, and preferences. If Codex is already running, the launcher shows an alert and exits because two processes must not use this profile concurrently.

### One-time Apple setup

You need an active Apple Developer Program membership, a **Developer ID Application** certificate with its private key in this Mac's keychain, and notarization credentials. An Apple Development, Apple Distribution, or Developer ID Installer certificate does not work for this app.

1. Sign in to [Apple Developer](https://developer.apple.com/account). The account holder can create a Developer ID Application certificate under Certificates, Identifiers & Profiles. Full Xcode is optional: create a certificate signing request in **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**, save it to disk, upload it to Apple, and download and double-click the resulting `.cer` to install it. The private key stays on the Mac that created the request. See [Apple's certificate instructions](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/).
2. Confirm the certificate and private key are available:

   ```sh
   security find-identity -v -p codesigning
   ```

   If it is missing from the valid identities, install [Apple's Developer ID G2 intermediate certificate](https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer) in the login keychain as well. Keep the default trust settings.

3. Create an app-specific password at [Apple Account → Sign-In and Security → App-Specific Passwords](https://account.apple.com). Store notarization credentials through the interactive terminal prompts:

   ```sh
   xcrun notarytool store-credentials "anywebmcp"
   ```

   Use your Apple Account email, Developer Team ID (from your membership details), and the app-specific password. The command validates and saves them in Keychain. Do not put passwords, private keys, or exported certificates in the repository or chat. A stored App Store Connect API key profile also works.

If exactly one Developer ID Application identity is installed, the build selects it automatically. To choose one explicitly or use another Keychain profile:

```sh
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
APPLE_NOTARY_PROFILE="anywebmcp" \
npm run codex:release
```

Equivalent CLI flags are `--signing-identity=<full certificate name or SHA-1>` and `--notary-profile=<name>`. Run `npm run codex:doctor -- --notarize` to check signing and notarization credentials alongside the existing local launcher checks. Credentials configured in the environment do not change development builds into signed releases.

Apple documents the [notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) and [command-line workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow).

## Local bundled build

To build the same bundled launcher without Apple credentials:

```sh
npm run codex:build
```

This produces an ad-hoc signed app and ZIP for local use. Transferred copies can be rejected by Gatekeeper; use `codex:release` for distribution. `npm run codex:build -- --signed` produces a Developer ID signed build without notarizing it, which is also insufficient for normal distribution.

## Custom extension directory

```sh
npm run codex:install -- --extension-dir=../another-extension/dist
```

Run diagnostics with:

```sh
npm run codex:doctor
```

The launcher never modifies `/Applications/ChatGPT.app`. Both modes keep versioned runtime copies under `~/Library/Application Support/Codex-WebMCP/Runtime`; only development mode creates a separate browser profile there.

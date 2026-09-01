# Codex launcher layer

`packages/codex-launcher` generates a macOS launcher that starts a locally installed Codex runtime with WebMCP testing enabled. Development launchers reference an external unpacked extension directory and use an isolated browser profile. Distributable launchers copy the extension into the generated app bundle, use the standard Codex profile, and do not require Node.js at runtime.

A universal native executable starts the bundled shell launcher. `npm run codex:release` signs it with Developer ID and hardened runtime, notarizes it with Apple, staples the ticket, verifies Gatekeeper acceptance, and packages the final ZIP. Local builds remain ad-hoc signed and do not require Apple credentials.

The generated launcher never contains a committed Codex binary. On the recipient's machine it creates a signed local runtime copy from `/Applications/ChatGPT.app`. Production and standard Codex must not run concurrently because they share user data.

See [the launcher package documentation](../../packages/codex-launcher/README.md) for build, installation, and distribution instructions.

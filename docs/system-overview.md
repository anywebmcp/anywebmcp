# AnyWeb MCP system overview

AnyWeb MCP adds WebMCP tools to supported websites through a Chromium extension. This repository contains everything needed to run AnyWeb MCP with Codex.

For tool authoring, start with the normative [site package standard](site-package-standard.md), then read [Site metadata](site-metadata.md), [Developing site tools](developing-site-tools.md), and the [tool result contract](tool-result-contract.md).

## Layers

- [Chrome extension](layers/chrome-extension.md) — loads the appropriate site integration on supported domains.
- [Site packages](layers/site-packages.md) — define the tools and website-specific behavior for each supported site.
- [Common package](layers/common-package.md) — provides shared contracts and browser-side registration helpers.
- [Codex launcher](layers/codex-launcher.md) — builds macOS launchers for developing and distributing AnyWeb MCP with Codex.

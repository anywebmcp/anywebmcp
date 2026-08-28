# AnyWeb MCP system overview

AnyWeb MCP adds WebMCP tools to supported websites through a Chromium extension. This repository contains everything needed to run AnyWeb MCP with Codex.

## Layers

- [Chrome extension](layers/chrome-extension.md) — loads the appropriate site integration on supported domains.
- [Site packages](layers/site-packages.md) — define the tools and website-specific behavior for each supported site.
- [Common package](layers/common-package.md) — provides shared contracts and browser-side registration helpers.
- [Codex launcher](layers/codex-launcher.md) — builds macOS launchers for developing and distributing AnyWeb MCP with Codex.

# Common package layer

`packages/common` contains shared TypeScript contracts and the small browser-side helpers that register packaged site tools with `document.modelContext` and manage their lifecycle.

The [site package standard](../site-package-standard.md) defines the boundary between shared runtime behavior and website-specific behavior.

Tool authors return `completed(data)`, `failed(message)`, or `navigationRequired(url, instruction, continuationToken?)`. The shared `WebMcpTool` type requires these outcomes. At registration, `wrapTool` checks result envelopes, formats text responses, and converts exceptions to safe failures. It also forwards execution options and preserves cancellation. See the [tool result contract](../tool-result-contract.md).

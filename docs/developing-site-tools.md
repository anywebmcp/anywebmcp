# Developing site tools

The normative [site package standard](site-package-standard.md) owns cross-package boundaries and safety requirements. This guide owns the implementation-selection guidance and tool-description guidance below. Follow the [tool result contract](tool-result-contract.md) for completion, failure, and navigation outcomes.

For each operation in a new or existing website integration, choose the implementation in this order:

1. **Official API:** Use it when it works within the session, credential, and cross-origin rules in the site package standard.
   - Test whether the API works using safe, read-only operations before relying on it.
2. **Browser UI:** Otherwise, implement the operation through the website's normal browser flow using the DOM and page interactions.
   - Prefer selectors and tokens that are least likely to change due to user customization or website updates.
3. **Internal API:** If the UI approach is not practical, inspect the requests made by the website and use its internal endpoints with the existing session.

Prefer the earliest viable option. Document implementation assumptions in the site package README and benchmark completed tools using [Benchmarking site tools](benchmarking-site-tools.md).

## Tool descriptions

Describe the tool's behavior, inputs, output, scope, and side effects. Do not mention implementation choices such as DOM queries, APIs, selectors, endpoints, or GraphQL. Put those details in the site package README or a technical document.

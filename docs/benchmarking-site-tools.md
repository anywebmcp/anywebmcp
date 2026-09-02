# Benchmarking site tools

This document owns the benchmark method and benchmark-file content. Cross-package architecture and safety requirements belong to the [site package standard](site-package-standard.md).

Benchmark each site with one short, natural, repeatable request representing a real task for that site. The request may require multiple WebMCP tools.

1. The request must remain useful on future dates. Do not hard-code products, posts, IDs, result limits, tool names, or testing instructions.
2. Define the expected outcome and objective success criteria.
3. Run the request in fresh Codex tasks with and without WebMCP. Use the same model, reasoning effort, starting URL, account state, and equivalent live data.
4. Before measuring, verify that the site opens and the required WebMCP tools are available and executable.
5. Run each approach at least three times, alternating their order.
6. Measure from submitting the request to the final answer. Record input, cached input, output, and total tokens from the final cumulative usage reported for the complete Codex run.
7. Record successful and failed runs. Do not discard failures.
8. Report individual results and medians in `packages/sites/<site>/BENCHMARKS.md`.

Each benchmark file should contain only the request; date, model, environment, and success criteria; individual run measurements; the median comparison; and brief notes about failures or material live-data differences.

Cached input tokens are a subset of input tokens and MUST NOT be added to input or total tokens. When the runtime does not report cached input separately, record `N/A` rather than estimating it. If uncached input is compared, calculate `input tokens - cached input tokens` for each individual run before calculating the median. Calculate every median independently from its per-run values; do not derive one median by subtracting other medians.

| Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 0 s | 0 | 0 | 0 | 0 | Passed |
| With WebMCP | 1 | 0 s | 0 | 0 | 0 | 0 | Passed |

Update the benchmark when tool behavior or the website changes materially. Never include credentials or private user data.

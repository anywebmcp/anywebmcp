# Benchmarking site tools

This document owns the benchmark method and benchmark-file content. Cross-package architecture and safety requirements belong to the [site package standard](site-package-standard.md).

Benchmark each site with one short, natural, repeatable request representing a real task for that site. The request may require multiple WebMCP tools.

1. The request must remain useful on future dates. Do not hard-code products, posts, IDs, result limits, tool names, or testing instructions.
2. Define the expected outcome and objective success criteria.
3. Run the request in fresh Codex tasks with and without WebMCP. Use the same model, reasoning effort, starting URL, account state, and equivalent live data.
4. Before measuring, verify that the site opens and the required WebMCP tools are available and executable.
5. Run each approach at least three times, alternating their order.
6. Measure from submitting the request to the final answer. Record input, output, and total tokens for the complete Codex run.
7. Record successful and failed runs. Do not discard failures.
8. Report individual results and medians in `packages/sites/<site>/BENCHMARKS.md`.

Each benchmark file should contain only the request; date, model, environment, and success criteria; individual run measurements; the median comparison; and brief notes about failures or material live-data differences.

| Approach | Run | Time | Input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 0 s | 0 | 0 | 0 | Passed |
| With WebMCP | 1 | 0 s | 0 | 0 | 0 | Passed |

Update the benchmark when tool behavior or the website changes materially. Never include credentials or private user data.

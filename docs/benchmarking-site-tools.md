# Benchmarking site tools

This document owns the benchmark method and benchmark-file content. Cross-package architecture and safety requirements belong to the [site package standard](site-package-standard.md).

Benchmark each tool against completing the same operation through the browser without WebMCP.

1. Define a representative operation and the expected successful result.
2. Run it with and without WebMCP from equivalent starting states, using the same model and task instruction. Use safe operations or controlled test data.
3. Run each approach at least three times, alternating which approach runs first to reduce caching and order bias.
4. Measure elapsed time from the start of the request to successful completion and record the total token consumption of the agent run.
5. Record every run, then report the median results. Include input/output token details when available.

Store results in `packages/sites/<site>/BENCHMARKS.md`. Include the date, model, test environment, operation details, number of runs, and individual measurements, followed by this summary table:

| Tool | Operation | Without WebMCP time | Without WebMCP tokens | With WebMCP time | With WebMCP tokens |
| --- | --- | ---: | ---: | ---: | ---: |
| `tool_name` | Description | 0 s | 0 | 0 s | 0 |

Update the file when tool behavior or the website changes materially. Never include credentials or private user data.

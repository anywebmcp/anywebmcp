# Hacker News tool benchmarks

No model-vs-browser benchmark results are claimed yet. The adapter needs to be loaded in a WebMCP-enabled Chrome/Codex session so equivalent agent runs can be recorded with elapsed time and token consumption as required by `docs/benchmarking-site-tools.md`.

The implementation has separate automated live-API smoke coverage. Run it with:

```sh
npm run test:live -w @openwebmcp/site-hackernews
```

The first browser benchmark should cover these representative operations, with at least three alternating runs per operation:

1. Use `hackernews_market_digest` to identify the five most discussed explicit product launches from the previous seven days and provide source links.
2. Use `hackernews_research_topic` to assemble evidence about interest in a topic across the previous year, including launches, problem discussions, and directly matched comments.
3. Use `hackernews_read_thread` to extract the largest discussion branches from a story while preserving comment permalinks and reply context.

Record dated results below using the repository benchmark template once that WebMCP browser session is available.

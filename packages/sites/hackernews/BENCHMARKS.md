# Hacker News benchmark

## Request

> Research how developers currently feel about local-first software on Hacker News. Summarize recurring problems, notable product launches, and the strongest evidence for adoption or skepticism, with links to the supporting threads.

## Setup and success criteria

- Date: 2026-09-03
- Model: `gpt-5.6-sol`, low reasoning effort (Sol Light)
- Environment: Codex Desktop `0.151.0-alpha.7.2` on macOS, bundled Chromium `151.0.7922.174`, AnyWeb MCP extension `0.1.0`, fresh projectless Codex tasks, fresh in-app Browser tabs, `https://news.ycombinator.com/` starting URL, a public signed-out Hacker News session, and live Hacker News data. The browser-only condition used visible Hacker News pages and the HN Search interface linked from the Hacker News footer; the WebMCP condition used page-defined Hacker News tools and did not use visible page text as research evidence. Neither condition used general web search, direct API calls, shell-based network access, or non-Hacker-News sources.
- Measurement: elapsed time is the Codex turn duration from request submission through the final answer. Token counts are the final cumulative usage for the complete task. Cached input tokens are a subset of input tokens and are not added to input or total tokens.
- Expected outcome: an evidence-based synthesis of current Hacker News sentiment about local-first software that identifies recurring technical, product, and business problems; names notable launches; distinguishes evidence of real adoption from developer interest; presents the strongest skeptical case; and links every material claim to supporting Hacker News discussion threads.
- A run passes when it describes at least three recurring problem categories, links at least three relevant product-launch threads, gives linked evidence for both adoption and skepticism, distinguishes Hacker News engagement from broad market adoption, and follows its assigned browser-only or WebMCP collection method without fallback.
- Scope: this is a preliminary one-run-per-approach check requested before the standard three runs per approach. It does not satisfy the repository's full benchmark sample-size requirement and does not establish medians.

## Individual measurements

| Order | Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Without WebMCP | 1 | 94.119 s | 651,496 | 594,560 | 3,377 | 654,873 | Passed |
| 2 | With WebMCP | 1 | 48.489 s | 274,058 | 249,216 | 1,321 | 275,379 | Failed — Hacker News data request could not reach the network |

## Preliminary comparison

| Approach | Observed time | Input tokens | Cached input tokens | Uncached input tokens | Output tokens | Total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 94.119 s | 651,496 | 594,560 | 56,936 | 3,377 | 654,873 | 1/1 |
| With WebMCP | 48.489 s | 274,058 | 249,216 | 24,842 | 1,321 | 275,379 | 0/1 |

No performance conclusion is valid from these observations. There is only one run per approach, and the WebMCP run stopped after data collection failed, so its lower elapsed time and token use are not comparable with the successful browser-only result.

## Notes

- The two fresh tasks ran in the order without WebMCP, then with WebMCP. The control used the visible Hacker News front page, its footer-linked HN Search interface on `hn.algolia.com`, and visible Hacker News discussion pages. Its execution log contained no Hacker News WebMCP calls.
- Before measurement, Hacker News opened successfully and all three page-defined tools were registered: `hackernews_market_digest`, `hackernews_research_topic`, and `hackernews_read_thread`. A minimal `hackernews_research_topic` preflight returned `status: "failed"` with the same network error later seen in the measured WebMCP run. The requested 1+1 diagnostic was retained despite the failed executability precondition; it is not a completed site-level benchmark.
- In the measured WebMCP run, the first handle became stale before execution, the task refreshed the page-defined tool list, and one actual `hackernews_research_topic` request then returned `status: "failed"` with `Hacker News data request was blocked or could not reach the network.` The task did not fall back to browser extraction or another source.
- After the runs, the Hacker News offline suite passed all 19 tests and the separate Node live-smoke harness successfully called all three tools against current data. Direct checks of the Algolia HN Search API and Hacker News Firebase API both returned HTTP 200. The extension background and Hacker News bundles loaded by Codex matched the current repository build byte-for-byte at commit `58f051030c3b1f9af46ad001a36bfd1b31ff4176`. These checks localize the observed failure to the extension's page-defined background transport in the measured Codex Browser environment rather than to the Hacker News APIs, checked-out source, or tool logic.
- The successful browser-only run reported recurring problems around conflict semantics, CRDT complexity, schema migration, authentication and authorization, encryption and key management, binary assets, browser storage eviction, multi-device synchronization, SaaS economics, and recovery responsibility. It linked high-engagement discussions and launch threads for ElectricSQL, CADmium, Anytype, Whispering, and Zedless, while explicitly treating Hacker News engagement as developer interest rather than market-size evidence.
- After the measured runs, the background transport was changed to invoke `fetch`, `setTimeout`, and `clearTimeout` through worker-scope-bound adapters. A rebuilt isolated development launcher then completed an end-to-end `hackernews_read_thread` call for story `44473135`, returning the story and one requested comment with `status: "completed"`. This post-fix verification confirms the browser transport works but does not replace the retained failed measurement or add another benchmark run.

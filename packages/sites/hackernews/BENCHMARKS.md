# Hacker News benchmark

## Request

> Research how developers currently feel about local-first software on Hacker News. Summarize recurring problems, notable product launches, and the strongest evidence for adoption or skepticism, with links to the supporting threads.

## Setup and success criteria

- Date: 2026-09-03
- Model: `gpt-5.6-sol`, low reasoning effort (Sol Light)
- Environment: Codex Desktop `0.151.0-alpha.7.2` on macOS; fresh projectless Codex tasks; fresh in-app Browser tabs; `https://news.ycombinator.com/` starting URL; a public signed-out Hacker News session; AnyWeb MCP Hacker News site package `0.1.0` at repository commit `fa075bc66fba`; and live Hacker News data. The browser-only condition used visible Hacker News pages and the HN Search interface linked from the Hacker News footer. The WebMCP condition used page-defined Hacker News tools and did not use visible page text as research evidence. Neither condition used general web search, direct API calls, shell-based network access, connectors, or non-Hacker-News sources.
- Preflight: Hacker News opened successfully and `hackernews_market_digest`, `hackernews_research_topic`, and `hackernews_read_thread` were available. Immediately before measurement, a read-only `hackernews_research_topic` smoke call completed against live data.
- Measurement: elapsed time is the complete Codex task duration from request submission through the final answer. Token counts are the final cumulative usage recorded for each complete task. Cached input tokens are a subset of input tokens and are not added to input or total tokens.
- Expected outcome: an evidence-based synthesis of current Hacker News sentiment about local-first software that identifies recurring technical, product, and business problems; names notable launches; distinguishes evidence of real adoption from developer interest; presents the strongest skeptical case; and links every material claim to supporting Hacker News discussion threads.
- A run passes when it describes at least three recurring problem categories, links at least three relevant product-launch threads, gives linked evidence for both adoption and skepticism, distinguishes Hacker News engagement from broad market adoption, and follows its assigned browser-only or WebMCP collection method without fallback.

## Individual measurements

| Order | Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Without WebMCP | 1 | 124.711 s | 867,170 | 792,448 | 4,897 | 872,067 | Passed |
| 2 | With WebMCP | 1 | 100.348 s | 637,686 | 579,968 | 3,730 | 641,416 | Passed |
| 3 | With WebMCP | 2 | 128.063 s | 708,730 | 634,496 | 4,714 | 713,444 | Passed |
| 4 | Without WebMCP | 2 | 112.289 s | 833,311 | 758,016 | 4,603 | 837,914 | Passed |
| 5 | Without WebMCP | 3 | 131.121 s | 1,133,504 | 1,054,720 | 4,837 | 1,138,341 | Passed |
| 6 | With WebMCP | 3 | 187.273 s | 771,577 | 703,360 | 4,394 | 775,971 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median cached input tokens | Median uncached input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 124.711 s | 867,170 | 792,448 | 75,295 | 4,837 | 872,067 | 3/3 |
| With WebMCP | 128.063 s | 708,730 | 634,496 | 68,217 | 4,394 | 713,444 | 3/3 |

WebMCP reduced median input tokens by 18.3%, cached input tokens by 19.9%, independently calculated uncached input tokens by 9.4%, output tokens by 9.2%, and total tokens by 18.2%. Median elapsed time was 3.352 seconds, or 2.7%, longer with WebMCP.

## Notes

- Runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. All six complete runs passed every success criterion and none changed Hacker News state.
- The three browser-only runs used the visible Hacker News front page, its footer-linked HN Search interface on `hn.algolia.com`, and visible Hacker News discussion pages. Their execution logs contained no Hacker News WebMCP calls.
- The three WebMCP runs used `hackernews_research_topic` for broad evidence packs, `hackernews_market_digest` for launch scans, and `hackernews_read_thread` when deeper comment context was needed. Browser activity was limited to opening Hacker News and checking tool availability; the runs made no DOM data reads and did not fall back to another collection method.
- WebMCP run 2 recovered from an initially stale or unavailable tool snapshot by refreshing the page-defined tool handles and retrying the same operation. The retry and all subsequent research calls completed; no fallback source was used.
- Live results differed in which qualifying launches were highlighted. ElectricSQL, Whispering, Anytype, One, LocalGPT, PowerSync, Muse 2.0, Triplit, CADmium, OpenKnowledge, and other launches appeared in different passing answers depending on the collected evidence. The reported comment count for the 2025 “Local-first software” thread also varied between 277 and 297 across live surfaces. Every answer grounded adoption and skepticism in linked Hacker News threads and explicitly treated Hacker News activity as an interest signal rather than market-size evidence.

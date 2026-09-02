# Product Hunt benchmark

## Request

> Find the most-discussed launch tagged Developer Tools on Product Hunt’s latest completed daily leaderboard. Explain what problem it solves and summarize the main praise and concerns from its discussion.

## Setup and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`, medium reasoning effort
- Environment: Codex Desktop 0.151.0-alpha.7.2 on macOS, Product Hunt in the in-app Browser, `https://www.producthunt.com/` starting URL, the same signed-in Product Hunt session, and live Product Hunt data. The browser-only condition used Product Hunt's visible UI and DOM without WebMCP; the WebMCP condition used Product Hunt's page-defined tools for data extraction and ordinary browser interaction only for navigation.
- Preflight: Product Hunt and its latest completed daily leaderboard opened successfully. `producthunt_list_launches`, `producthunt_read_product`, and `producthunt_list_comments` were available and completed live smoke calls before measurement. A method audit confirmed that the three WebMCP runs made no DOM data reads and the three control runs invoked no Product Hunt WebMCP tools.
- Expected outcome: select the launch tagged Developer Tools with the highest displayed comment count on the latest completed daily leaderboard, explain the concrete problem it addresses, and synthesize the main praise and concerns from its Product Hunt discussion. A run passes only if the selected launch and comment count match the live leaderboard, the explanation and discussion summary are grounded in Product Hunt, and the assigned browser-only or WebMCP condition is followed.

## Individual measurements

| Order | Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Without WebMCP | 1 | 127.566 s | 787,278 | 723,968 | 3,257 | 790,535 | Passed — Kilo Code for JetBrains |
| 2 | With WebMCP | 1 | 171.994 s | 751,985 | 690,816 | 3,290 | 755,275 | Passed — Kilo Code for JetBrains |
| 3 | With WebMCP | 2 | 232.025 s | 1,447,938 | 1,389,568 | 5,419 | 1,453,357 | Passed — Kilo Code for JetBrains |
| 4 | Without WebMCP | 2 | 192.692 s | 1,246,567 | 1,156,224 | 4,155 | 1,250,722 | Passed — Kilo Code for JetBrains |
| 5 | Without WebMCP | 3 | 196.062 s | 1,460,058 | 1,355,904 | 5,278 | 1,465,336 | Passed — Kilo Code for JetBrains |
| 6 | With WebMCP | 3 | 186.567 s | 787,600 | 736,640 | 3,827 | 791,427 | Passed — Kilo Code for JetBrains |

## Median comparison

| Approach | Median time | Median input tokens | Median cached input tokens | Median uncached input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 192.692 s | 1,246,567 | 1,156,224 | 90,343 | 4,155 | 1,250,722 | 3/3 |
| With WebMCP | 186.567 s | 787,600 | 736,640 | 58,370 | 3,827 | 791,427 | 3/3 |

WebMCP reduced median input tokens by 36.8%, cached input tokens by 36.3%, independently calculated uncached input tokens by 35.4%, output tokens by 7.9%, and total tokens by 36.7%. Median elapsed time was 6.125 seconds, or 3.2%, faster with WebMCP.

## Notes

- Runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. All six complete runs passed.
- WebMCP run 1 recovered from one initially empty tool snapshot. WebMCP run 2 recovered from three stale or temporarily empty tool snapshots while paging through the discussion. No Product Hunt WebMCP operation caused a complete-run failure.
- Live data remained materially equivalent across the benchmark: every run selected Kilo Code for JetBrains from the September 1, 2026 leaderboard and reported 88 comments and 489 points or upvotes.

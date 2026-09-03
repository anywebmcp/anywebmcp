# Reddit benchmark

## Request

> Find a recent Reddit discussion where developers are debating AI coding assistants, summarize the strongest arguments on both sides, check the community rules, and prepare a constructive reply.

## Setup and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`, high reasoning effort
- Environment: Codex Desktop `0.151.0-alpha.7.2` on macOS; fresh projectless tasks; the in-app Browser at `https://www.reddit.com/`; the same signed-in Reddit session; and live Reddit data. The browser-only condition used Reddit's visible UI and DOM without page-defined tools. The WebMCP condition used Reddit's four page-defined tools for data extraction and draft preparation, with ordinary browser interaction only for navigation. Neither condition used web search, connectors, or external sources.
- Preflight: Reddit opened successfully, all four Reddit tools were available, and `reddit_collect_listing` completed a live read-only smoke call with `status: "completed"` before measurement. A method audit found no Reddit WebMCP calls in the three browser-only runs and no Reddit DOM data reads in the four WebMCP runs.
- Expected outcome: select a Reddit discussion posted within the previous 30 days where developers substantively debate AI coding assistants; identify the thread, subreddit, permalink, and date; ground a fair summary of the strongest arguments on both sides in the loaded discussion; check the complete current community rules; and prepare an exact, constructive, rules-aware reply in Reddit's editor without submitting it. A browser-only run passes only when it reads the draft back from the editor and verifies that the submission control was not activated. A WebMCP run passes only when `reddit_prepare_reply_draft` reports `verified: true` and `submitted: false`. Every run must also follow its assigned collection method and avoid voting, saving, joining, publishing, or other engagement.

## Individual measurements

| Order | Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Without WebMCP | 1 | 315.845 s | 2,838,554 | 2,682,368 | 8,392 | 2,846,946 | Passed — r/gamedev, “I dont even understand how people use AI to code” |
| 2 | With WebMCP | 1 | 295.004 s | 1,136,388 | 1,085,184 | 6,612 | 1,143,000 | Failed — draft insertion could not be verified exactly |
| 3 | With WebMCP | 2 | 429.156 s | 1,671,667 | 1,575,424 | 10,348 | 1,682,015 | Passed — r/AI_Agents, “What is your biggest fear about AI coding assistants and security?” |
| 4 | Without WebMCP | 2 | 255.983 s | 1,494,649 | 1,371,136 | 7,442 | 1,502,091 | Passed — r/gamedev, “I dont even understand how people use AI to code” |
| 5 | Without WebMCP | 3 | 267.963 s | 2,373,794 | 2,256,000 | 7,221 | 2,381,015 | Passed — r/ChatGPTCoding, “Claude Code vs GitHub Copilot: Token burn comparison using identical models & repos?” |
| 6 | With WebMCP | 3 | 364.780 s | 1,205,306 | 1,141,504 | 8,602 | 1,213,908 | Passed — r/ExperiencedDevs, “Why does it feel like some people live in a parallel universe?” |
| 7 | With WebMCP | 4 | 238.631 s | 797,667 | 753,920 | 6,337 | 804,004 | Passed — r/artificial, “AI coding tools are saving me hours but I keep secondguessing whether I actually understand what I shipped” |

## Median comparison of passed runs

| Approach | Median time | Median input tokens | Median cached input tokens | Median uncached input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 267.963 s | 2,373,794 | 2,256,000 | 123,513 | 7,442 | 2,381,015 | 3/3 |
| With WebMCP | 364.780 s | 1,205,306 | 1,141,504 | 63,802 | 8,602 | 1,213,908 | 3/4 |

Among passed runs, WebMCP reduced median input tokens by 49.2%, cached input tokens by 49.4%, independently calculated uncached input tokens by 48.3%, and total tokens by 49.0%. Median output tokens increased by 15.6%, and median elapsed time was 96.817 seconds, or 36.1%, longer with WebMCP. The failed WebMCP run remains in the individual measurements and overall 3/4 pass rate but is excluded from every median.

## Notes

- The initial six runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. One additional fresh WebMCP run was added afterward to reach three successful WebMCP runs. All three browser-only runs passed; three of four WebMCP runs passed. No run submitted a reply or otherwise engaged with Reddit.
- WebMCP run 1 completed discovery, thread reading, rule checking, and draft insertion, but Reddit's editor read-back was 12 characters shorter than the requested text. The tool then protected the nonempty editor from overwrite, so the run could not obtain `verified: true` or `submitted: false`. The failure remains in the individual measurements and pass rate but is excluded from the passed-run medians.
- WebMCP runs 2, 3, and 4 recovered from Reddit collapsing paragraph breaks by preparing a single-paragraph version. All three ended with `verified: true` and `submitted: false`; the exact verified drafts contained joined sentence transitions and the final answers disclosed that normalization.
- The seven runs selected six distinct live discussions posted between August 19 and September 2, 2026. Browser-only runs 1 and 2 independently selected the same r/gamedev thread; the remaining runs selected different qualifying discussions. Loaded comment coverage varied from 16 comments to bounded samples of 100 or 178 comments from much larger threads.

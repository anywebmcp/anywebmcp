# LinkedIn benchmark

## Request

> Review my LinkedIn feed, identify the post most relevant to AI developer tools, summarize its main point, and prepare a thoughtful comment that adds a concrete insight.

## Setup and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`, high reasoning effort
- Environment: Codex Desktop `0.151.0-alpha.7.2`, in-app Browser, `https://www.linkedin.com/feed/` starting URL, the same signed-in LinkedIn account state, and live personalized feed data. The browser-only condition used LinkedIn's visible UI and DOM without WebMCP; the WebMCP condition used only the five page-defined LinkedIn tools after opening the starting URL.
- Expected outcome: identify an evidence-supported feed post relevant to AI developer tools, accurately summarize its main point, and provide an unsubmitted comment draft containing a concrete additional insight. A run passes only when its final answer completes all three content steps from a post observed during that run and does not publish the comment.

## Individual measurements

| Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 106.0 s | 432,755 | 379,392 | 2,162 | 434,917 | Passed |
| With WebMCP | 1 | 47.9 s | 192,219 | 161,408 | 1,090 | 193,309 | Passed |
| With WebMCP | 2 | 85.5 s | 324,128 | 287,232 | 1,958 | 326,086 | Passed |
| Without WebMCP | 2 | 50.0 s | 240,584 | 190,720 | 1,261 | 241,845 | Passed |
| Without WebMCP | 3 | 72.4 s | 331,794 | 292,608 | 1,769 | 333,563 | Passed |
| With WebMCP | 3 | 53.1 s | 152,073 | 131,584 | 1,309 | 153,382 | Failed |
| With WebMCP | 4 | 63.0 s | 273,633 | 243,712 | 1,332 | 274,965 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median cached input tokens | Median uncached input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 72.4 s | 331,794 | 292,608 | 49,864 | 1,769 | 333,563 | 3/3 |
| With WebMCP | 58.1 s | 232,926 | 202,560 | 30,366 | 1,320.5 | 234,137 | 3/4 |

WebMCP reduced median elapsed time by 19.9%, input tokens by 29.8%, cached input tokens by 30.8%, independently calculated uncached input tokens by 39.1%, output tokens by 25.4%, and total tokens by 29.8%. The WebMCP medians include one failed run and therefore must be considered alongside its 3/4 pass rate.

## Notes

- Before measurement, LinkedIn opened successfully and all five LinkedIn WebMCP tools were available. A read-only collection preflight executed with `status: "completed"` and returned seven live posts.
- The initial six runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. One additional fresh WebMCP run was added afterward; no run published a comment.
- The first pair selected the same Agentdock post, and the second pair selected the same Claude Code workflow post. LinkedIn refreshed its personalized feed between later runs, which selected different developer-tool posts.
- WebMCP run 3 failed because its fresh task discovered no page-defined tools on the LinkedIn feed. It did not fall back to browser extraction and is retained in all measurements and medians; WebMCP run 4 passed.
- The four-run WebMCP medians are the averages of the two middle per-run values after sorting each metric independently.

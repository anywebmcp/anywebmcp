# X benchmark

## Request

“Review the first 15 posts in my current For You timeline on X, choose the one most relevant to AI developer tools, summarize why it matters, and prepare a thoughtful reply as text that adds a concrete insight. Do not open the reply composer or publish anything.”

## Setup and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`, high reasoning effort
- Environment: Codex Desktop 0.151.0-alpha.7.2 on macOS; fresh projectless tasks; in-app Browser at `https://x.com/home`; the same signed-in X account and selected For You tab for both approaches; live timeline data; alternating browser-only and WebMCP runs. Before measurement, X opened successfully and `x_get_posts` was available and executable.
- Experimental exception: the request intentionally fixes the reviewed set at the first 15 posts so both approaches perform the same amount of collection work. This deliberately departs from the repository's usual guidance against hard-coding a result limit and is specific to this controlled experiment.
- Collection boundary: the first 15 unique top-level post cards with a permalink, in display order from the top of For You; promoted cards count when they have a post permalink. Browser-only runs used visible DOM/UI and stopped at 15. WebMCP runs used a batch limit of 15. Neither approach opened a reply composer or prepared a reply intent.
- Expected outcome: choose the post among those 15 that is most relevant to AI developer tools, explain its significance, and provide—but do not publish—a thoughtful reply containing a concrete insight.
- A run passes when it reviews exactly 15 qualifying posts, identifies an observed post by author or link, gives an accurate relevance summary, supplies a specific and additive reply draft, makes no account-changing action, and exposes no credential or private data.

## Individual measurements

Measurements cover request submission through the final answer. Rows are in execution order.

| Approach | Run | Time | Input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 102.558 s | 316,933 | 2,679 | 319,612 | Passed |
| With WebMCP | 1 | 71.148 s | 278,195 | 1,520 | 279,715 | Passed |
| Without WebMCP | 2 | 159.040 s | 600,595 | 4,450 | 605,045 | Passed |
| With WebMCP | 2 | 140.275 s | 400,799 | 3,864 | 404,663 | Passed |
| Without WebMCP | 3 | 156.203 s | 611,170 | 4,153 | 615,323 | Passed |
| With WebMCP | 3 | 62.122 s | 241,523 | 1,452 | 242,975 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median output tokens | Median total tokens | Passed runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 156.203 s | 600,595 | 4,153 | 605,045 | 3/3 |
| With WebMCP | 71.148 s | 278,195 | 1,520 | 279,715 | 3/3 |

With the collection size fixed, WebMCP used 325,330 fewer median total tokens (53.8% less) and completed 85.055 seconds sooner at the median (54.5% faster).

## Notes

- No measured run failed.
- The live For You timeline changed between runs, so each run selected a different post. In one WebMCP run, none of the first 15 posts explicitly discussed AI developer tools; that run identified and explained the closest match and still met the relative-selection request.
- Browser-only logs contained no WebMCP calls. Every WebMCP run returned exactly 15 posts with the limit stop reason. No measured run called the reply-preparation tool, opened a reply composer, published, or engaged with a post.

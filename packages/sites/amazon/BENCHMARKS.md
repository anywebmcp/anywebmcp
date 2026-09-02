# Amazon benchmark

## Request

> Find a well-rated USB-C hub on Amazon that supports HDMI and power delivery, compare the strongest candidates, and recommend the best value based on current price, specifications, and recurring review concerns.

## Setup and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`, medium reasoning effort
- Environment: Codex Desktop 0.151.0-alpha.7.2, in-app Browser, `https://www.amazon.com/` starting URL, signed-out Amazon session, delivery location Lithuania, and live Amazon.com data. The browser-only condition used Amazon's visible UI and DOM without WebMCP; the WebMCP condition used the six page-defined Amazon tools from the same starting page and session.
- Expected outcome: compare at least three Amazon-listed USB-C hubs rated 4.0 stars or higher that support HDMI and USB-C power delivery. A run passes when its final answer reports a current item price, rating evidence, HDMI capability, power-delivery rating, and at least one recurring review concern for the compared candidates, then makes one best-value recommendation justified by price, specifications, and review concerns.

## Individual measurements

| Approach | Run | Time | Input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 151.1 s | 778,257 | 4,038 | 782,295 | Passed |
| With WebMCP | 1 | 172.5 s | 504,783 | 3,886 | 508,669 | Passed |
| With WebMCP | 2 | 138.2 s | 53,537 | 306 | 53,843 | Passed |
| Without WebMCP | 2 | 139.2 s | 730,614 | 3,138 | 733,752 | Passed |
| Without WebMCP | 3 | 146.2 s | 652,332 | 3,532 | 655,864 | Passed |
| With WebMCP | 3 | 148.9 s | 72,144 | 476 | 72,620 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 146.2 s | 730,614 | 3,532 | 733,752 | 3/3 |
| With WebMCP | 148.9 s | 72,144 | 476 | 72,620 | 3/3 |

WebMCP reduced median input tokens by 90.1%, output tokens by 86.5%, and total tokens by 90.1%. Median elapsed time was 2.7 seconds, or 1.8%, longer with WebMCP.

## Notes

- Runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. All complete runs passed.
- Browser-only runs 1 and 3 each recovered from one browser locator or navigation error. WebMCP run 1 recovered from unavailable optional capability documentation; no Amazon WebMCP operation caused a complete-run failure.
- Amazon varied search ranking, candidate availability, review counts, prices, and Lithuania delivery charges during the benchmark. Item prices ranged from €7.71 to €35.16, displayed delivery charges were roughly €20 to €24, and different passing runs recommended UGREEN 5-in-1, QGeeM 4-in-1, BENFEI 7-in-1, or ACASIS 6-in-1.

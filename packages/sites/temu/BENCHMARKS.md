# Temu benchmark

## Request

> Find a compact USB-C travel charger on Temu, choose 5 candidates from the initial relevant results, and compare the information Temu readily provides for each, including displayed price, port count, power output, and plug options. Recommend the best one.

## Setup and success criteria

- Date: 2026-09-03
- Model: `gpt-5.6-sol`, low reasoning effort (Sol Light)
- Environment: Codex Desktop 0.151.0-alpha.7.2 on macOS; fresh projectless Codex tasks; in-app Browser; `https://www.temu.com/` starting URL; the same existing Temu browser/account state; Lithuania/English locale; and live Temu data. The browser-only condition used Temu's visible UI and DOM without WebMCP. The WebMCP condition used Temu's page-defined tools for product data and ordinary browser interaction only for navigation. Neither condition used web search or external sources.
- Preflight: Temu opened successfully and `temu_search_products`, `temu_read_product`, and `temu_compare_products` were available. Immediately before measurement, a read-only `temu_search_products` smoke call for the benchmark query completed and returned five live products.
- Measurement: elapsed time runs from request submission through the final answer. Token counts are the final cumulative usage for each complete Codex task. Cached input tokens are a subset of input tokens and are not added to input or total tokens.
- Expected outcome: select five compact USB-C travel chargers from the initial relevant Temu results in display order, compare the displayed price, port count, power output, and plug options Temu readily provides for each, identify missing fields rather than infer them, include direct Temu links, and recommend one candidate using only the displayed Temu information.
- A run passes only when its final answer covers exactly five candidates from the initial relevant results; includes a direct Temu link and displayed price for each; reports port count, power output, and plug options for each or explicitly says the field is not readily shown; makes a grounded recommendation; and follows its assigned browser-only or WebMCP method.

## Individual measurements

| Approach | Run | Time | Input tokens | Cached input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 93.375 s | 723,370 | 655,232 | 3,198 | 726,568 | Passed |
| With WebMCP | 1 | 64.298 s | 323,634 | 292,992 | 1,983 | 325,617 | Passed |
| With WebMCP | 2 | 91.000 s | 326,362 | 294,528 | 2,371 | 328,733 | Passed |
| Without WebMCP | 2 | 88.521 s | 434,332 | 380,544 | 3,001 | 437,333 | Passed |
| Without WebMCP | 3 | 71.456 s | 392,732 | 354,688 | 2,635 | 395,367 | Passed |
| With WebMCP | 3 | 76.130 s | 321,066 | 290,816 | 2,117 | 323,183 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median cached input tokens | Median uncached input tokens | Median output tokens | Median total tokens | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 88.521 s | 434,332 | 380,544 | 53,788 | 3,001 | 437,333 | 3/3 |
| With WebMCP | 76.130 s | 323,634 | 292,992 | 30,642 | 2,117 | 325,617 | 3/3 |

WebMCP reduced median elapsed time by 14.0%, input tokens by 25.5%, cached input tokens by 23.0%, independently calculated uncached input tokens by 43.0%, output tokens by 29.5%, and total tokens by 25.5%.

## Notes

- Runs were fresh Codex tasks and alternated by pair in this order: without/with, with/without, without/with. All six measured runs passed and none required manual verification.
- Verification-interrupted attempts were excluded from the measured set at the user's request. They were not resumed or included in the medians, and no task solved or bypassed Temu's verification.
- Browser-only run 1 recovered from one search-field interaction failure through Temu's visible submit-search control. Browser-only runs 2 and 3 stayed on the results page and used visible result cards or quick-look UI. The browser-only logs contained no Temu WebMCP calls.
- Every WebMCP run used `temu_search_products` followed by Temu's read or comparison tooling and did not fall back to DOM extraction for product facts. Temu sometimes returned only search-summary data, so the answers explicitly left unverified detail fields unspecified.
- Live inventory and ordering changed between preflight and the measured runs. Displayed prices across the selected products ranged from €15.23 to €27.84. Runs recommended either a 65W three-port multi-region charger, a lower-priced 65W three-port EU charger, or a 67W EU charger with a retractable cable depending on the initial result order and the displayed evidence available in that run.

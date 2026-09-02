# eBay benchmark

## Request

> Find a used mirrorless camera on eBay from a highly rated seller, compare the strongest candidates by total cost, condition, and return terms, and recommend the safest value.

## Configuration and success criteria

- Date: 2026-09-02
- Model: `gpt-5.6-sol`
- Reasoning effort: high
- Environment: Codex desktop on macOS, using fresh Codex tasks and fresh in-app browser tabs starting at `https://www.ebay.com/`. All runs used the same shared browser/account state and eBay's live US-site data localized for delivery to Lithuania. Runs alternated without and with WebMCP. Browser-only runs used eBay's visible UI and no page-defined tools; WebMCP runs used the eBay tools first and the visible UI only for fields the tools did not return. Neither approach used web search or external sources.
- Preflight: eBay opened successfully. All five package tools were available. `ebay_search_items` and `ebay_read_items`, the tools required for the structured search and comparison, both executed successfully before measurement.
- Measurement: elapsed time runs from request submission through the final answer. Token counts are the complete Codex task totals, including cached input tokens in the input count.
- Expected outcome: a live, evidence-based comparison of used mirrorless-camera listings from strong sellers that identifies the safest value rather than merely the lowest headline price.
- A run passes when it compares at least three live used mirrorless-camera listings; provides a direct listing link, item-plus-shipping total (or an explicit limitation), condition, seller-reputation evidence, and return terms or a clearly identified return-policy discrepancy for each candidate; recommends one listing from a seller with at least 99% positive feedback and at least 500 feedback or sales; explains the recommendation using cost, condition, seller strength, and return protection; and does not invent unavailable taxes, duties, or other missing data.

## Individual measurements

| Approach | Run | Time | Input tokens | Output tokens | Total tokens | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Without WebMCP | 1 | 336.750 s | 2,904,211 | 8,291 | 2,912,502 | Passed |
| With WebMCP | 1 | 192.777 s | 664,551 | 5,147 | 669,698 | Passed |
| Without WebMCP | 2 | 298.747 s | 2,600,391 | 7,330 | 2,607,721 | Passed |
| With WebMCP | 2 | 205.987 s | 1,012,227 | 5,429 | 1,017,656 | Passed |
| Without WebMCP | 3 | 253.675 s | 2,240,675 | 6,763 | 2,247,438 | Passed |
| With WebMCP | 3 | 214.718 s | 1,117,852 | 5,413 | 1,123,265 | Passed |

## Median comparison

| Approach | Median time | Median input tokens | Median output tokens | Median total tokens | Passed runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Without WebMCP | 298.747 s | 2,600,391 | 7,330 | 2,607,721 | 3/3 |
| With WebMCP | 205.987 s | 1,012,227 | 5,413 | 1,017,656 | 3/3 |

WebMCP reduced median elapsed time by 31.0%, median input tokens by 61.1%, median output tokens by 26.2%, and median total tokens by 61.0%.

## Notes

- No measured run failed.
- Live inventory and ranking differed materially even during the alternating same-day runs: the first browser-only run selected older Nikon 1 and Sony NEX candidates, later browser-only runs converged on Sony a6000 kits, and WebMCP runs selected Nikon Z50 bodies, a mixed current-body shortlist, and Sony a6000 kits respectively.

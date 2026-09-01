# Reddit adapter smoke fixture

Serve the repository root over HTTP, open `packages/sites/reddit/test/fixture.html`, and inspect `window.registeredTools` after building the extension. The fixture exercises modern Reddit-style custom elements without contacting Reddit or requiring a signed-in account.

The draft smoke check should call `reddit_prepare_reply_draft` for `t1_reply1` and verify both the contenteditable value and `document.body.dataset.submitCount === "0"`.

## Direct adapter check

Bundle `src/api/dom.ts` as an ES module at `test/dom-test.generated.js`, serve the repository root, and open `fixture.html?direct=1`. The **Run direct adapter smoke test** button invokes all four underlying adapter functions without registering or calling WebMCP. The generated bundle is temporary and should not be committed.

Open `mod-rules-fixture.html` and run its direct rules test to exercise Reddit's `/mod/<community>/rules/` redirect shape and `mod-rule-item[rule-obj]` parsing.

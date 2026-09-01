import assert from "node:assert/strict";
import test from "node:test";
import { setWatchState } from "../src/api/watch-control";
import { fixtureDocument, installDom } from "./support";

test("changes watch state through the mounted control and verifies the result", async () => {
  const documentRoot = installDom(fixtureDocument("watch-controls.html"));
  const control = documentRoot.querySelector<HTMLElement>("[data-listingid='406995727358'] a");
  assert.ok(control);
  let clicks = 0;
  control.addEventListener("click", event => {
    event.preventDefault();
    clicks += 1;
    control.setAttribute("aria-label", "Remove from watchlist");
    control.setAttribute("href", "/myb/WatchListRemove?item=406995727358");
  });

  assert.deepEqual(await setWatchState({ itemId: "406995727358", watched: true }), {
    itemId: "406995727358",
    watched: true,
    changed: true,
    verified: true
  });
  assert.equal(clicks, 1);
});

test("does not click an ambiguous watch control", async () => {
  const documentRoot = installDom(fixtureDocument("watch-controls.html"));
  const control = documentRoot.querySelector<HTMLElement>("[data-listingid='111111111111'] button");
  assert.ok(control);
  let clicks = 0;
  control.addEventListener("click", () => { clicks += 1; });

  await assert.rejects(
    () => setWatchState({ itemId: "111111111111", watched: true }),
    /unknown state; no click was performed/i
  );
  assert.equal(clicks, 0);
});

test("does not click a hidden watch control", async () => {
  const documentRoot = installDom(fixtureDocument("watch-controls.html"));
  const control = documentRoot.querySelector<HTMLElement>("[data-listingid='222222222222'] a");
  assert.ok(control);
  let clicks = 0;
  control.addEventListener("click", () => { clicks += 1; });

  await assert.rejects(
    () => setWatchState({ itemId: "222222222222", watched: true }),
    /not present in the current eBay page/i
  );
  assert.equal(clicks, 0);
});

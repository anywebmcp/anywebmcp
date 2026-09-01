import assert from "node:assert/strict";
import test from "node:test";

test("the document_start X entry installs capture before mounting tools", async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const nativeFetch = async () => { throw new Error("offline fixture"); };
  const fixtureWindow = {
    fetch: nativeFetch,
    addEventListener() {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  };
  let registrations = 0;
  const fixtureDocument = {
    modelContext: {
      async registerTool() {
        assert.notEqual(fixtureWindow.fetch, nativeFetch, "capture must be active before tool registration");
        registrations += 1;
      }
    }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fixtureWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: fixtureDocument });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as Record<string, unknown>).window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete (globalThis as Record<string, unknown>).document;
  });

  await import("../../../extension/src/sites/x");
  const deadline = Date.now() + 500;
  while (registrations < 4 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(registrations, 4);
});

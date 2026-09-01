import assert from "node:assert/strict";
import test from "node:test";

test("importing the X package has no browser side effects", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
  try {
    const module = await import("../src/index");
    assert.equal(module.default.id, "x");
    assert.equal(typeof module.installNetworkCapture, "function");
    assert.equal("window" in globalThis, false);
    assert.equal("document" in globalThis, false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
  }
});

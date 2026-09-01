import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "../test-support/index";

test("imports, mounts, and checks wrapped site tool contracts", async t => {
  let fixture: typeof import("./fixtures/site");
  const harness = await importAndMountSite(async () => {
    fixture = await import("./fixtures/site");
    return fixture;
  });
  t.after(() => harness.dispose());

  assertSiteContract(harness, ["fixture_read", "fixture_prepare", "fixture_throw"]);
  assert.ok(harness.registrations.every(({ options }) => options?.signal instanceof AbortSignal));

  const readWithoutOptions = await harness.execute<{ value: string; optionsProvided: boolean }>(
    "fixture_read",
    { value: "one" }
  );
  assert.deepEqual(readWithoutOptions, {
    status: "completed",
    data: { value: "one", optionsProvided: false }
  });

  const readWithEmptyOptions = await harness.execute<{ value: string; optionsProvided: boolean }>(
    "fixture_read",
    { value: "two" },
    {}
  );
  assert.deepEqual(readWithEmptyOptions, {
    status: "completed",
    data: { value: "two", optionsProvided: true }
  });

  const navigation = await harness.execute("fixture_prepare", { value: "review me" });
  assert.deepEqual(navigation, {
    status: "navigation_required",
    url: "https://example.test/prepare?value=review%20me",
    instruction: "Open the fixture page and review the prepared value manually."
  });

  const safeFailure = await harness.execute("fixture_throw");
  assert.deepEqual(safeFailure, {
    status: "failed",
    message: "Tool execution failed. Verify the outcome before retrying an action that could change data."
  });
  assert.doesNotMatch(JSON.stringify(safeFailure), /private fixture detail/);

  const controller = new AbortController();
  const reason = new Error("fixture cancelled");
  controller.abort(reason);
  const executionsBeforeAbort = fixture!.readExecutions;
  await assert.rejects(
    () => harness.execute("fixture_read", {}, { signal: controller.signal }),
    error => error === reason
  );
  assert.equal(fixture!.readExecutions, executionsBeforeAbort);
});

import assert from "node:assert/strict";
import { createDirectFetchHackerNewsTransport } from "../src/transport/direct";
import { setHackerNewsTransport } from "../src/transport/state";

type RegisteredTool = {
  name: string;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(input: Record<string, unknown>): unknown | Promise<unknown>;
};

Object.defineProperty(globalThis, "window", { value: globalThis });
Object.defineProperty(globalThis, "addEventListener", { value: () => {} });

const registeredTools: RegisteredTool[] = [];
Object.defineProperty(globalThis, "document", {
  value: {
    modelContext: {
      async registerTool(tool: RegisteredTool) {
        registeredTools.push(tool);
      }
    }
  }
});

await import("../../../extension/src/sites/hackernews");
setHackerNewsTransport(createDirectFetchHackerNewsTransport(globalThis.fetch));
for (let attempt = 0; attempt < 50 && registeredTools.length < 3; attempt += 1) {
  await new Promise(resolve => setTimeout(resolve, 10));
}

assert.deepEqual(registeredTools.map(tool => tool.name), [
  "hackernews_market_digest",
  "hackernews_research_topic",
  "hackernews_read_thread"
]);
for (const tool of registeredTools) {
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.untrustedContentHint, true);
}

const tools = new Map(registeredTools.map(tool => [tool.name, tool]));
function parseToolResult(value: unknown) {
  const result = value as { content?: Array<{ type?: string; text?: string }> };
  assert.equal(result.content?.[0]?.type, "text");
  assert.ok(result.content[0].text);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.status, "completed");
  assert.ok(Object.hasOwn(parsed, "data"));
  return parsed.data;
}

const timings: Record<string, number> = {};
async function callTool(name: string, input: Record<string, unknown>) {
  const tool = tools.get(name);
  assert.ok(tool, `Expected ${name} to be registered.`);
  const startedAt = performance.now();
  const result = parseToolResult(await tool.execute(input));
  timings[name] = Math.round(performance.now() - startedAt);
  return result;
}

const digest = await callTool("hackernews_market_digest", {
  periodDays: 7,
  limit: 3,
  commentPreviewCount: 1
});
assert.ok(Array.isArray(digest.launches));
assert.equal(digest.coverage.searches.length, 7);
assert.ok(digest.launches.length > 0);
assert.ok(digest.launches.every((launch: Record<string, unknown>) =>
  typeof launch.id === "number" && Array.isArray(launch.launchSignals)
));

const research = await callTool("hackernews_research_topic", {
  topic: "local-first",
  queries: ["offline sync"],
  periodDays: 365,
  maxThreads: 3,
  maxEvidenceComments: 5
});
assert.ok(Array.isArray(research.topThreads));
assert.equal(research.coverage.queryStats.length, 4);
assert.ok(research.topThreads.length > 0);
assert.ok(research.coverage.queryStats.every((stat: Record<string, unknown>) =>
  typeof stat.totalHits === "number" && typeof stat.retrievedHits === "number"
));

const storyId = digest.launches[0]?.id ?? research.topThreads[0]?.id;
assert.ok(storyId, "Expected a recent launch or topic thread for the live thread smoke test.");
const thread = await callTool("hackernews_read_thread", {
  id: storyId,
  maxComments: 5,
  maxDepth: 3
});
assert.equal(thread.story.id, storyId);
assert.ok(Array.isArray(thread.comments));
assert.ok(thread.comments.every((comment: Record<string, unknown>) =>
  typeof comment.id === "number"
  && typeof comment.depth === "number"
  && typeof comment.permalink === "string"
));

console.info(JSON.stringify({
  registeredTools: registeredTools.map(tool => tool.name),
  timingsMs: timings,
  digestLaunches: digest.launches.length,
  researchThreads: research.topThreads.length,
  evidenceComments: research.evidenceComments.length,
  threadComments: thread.comments.length
}, null, 2));

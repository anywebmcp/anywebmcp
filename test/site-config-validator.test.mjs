import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { internals, validateSites } from "../scripts/site-config/validator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];

function configFor(id = "alpha") {
  return {
    id,
    title: "Alpha",
    version: "0.1.0",
    matches: [`https://www.${id}.com/*`],
    runAt: "document_idle"
  };
}

async function makeSite({ id = "alpha", config = configFor(id), toolName = `${id}_read`, parent } = {}) {
  const root = parent ?? await mkdtemp(path.join(os.tmpdir(), "openwebmcp-minimal-metadata-"));
  if (!parent) temporaryRoots.push(root);
  const siteDir = path.join(root, id);
  await mkdir(path.join(siteDir, "src/tools"), { recursive: true });
  await writeFile(path.join(siteDir, "site.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(siteDir, "package.json"), JSON.stringify({ name: `@openwebmcp/site-${id}` }));
  await writeFile(path.join(siteDir, "README.md"), `# ${id}\n`);
  await writeFile(path.join(siteDir, "src/index.ts"), `
import { defineSite } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { readTool } from "./tools/read";
export const manifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};
export default defineSite({ ...manifest, tools: [readTool] });
`);
  await writeFile(path.join(siteDir, "src/tools/read.ts"), `export const readTool = { name: ${JSON.stringify(toolName)} };\n`);
  return siteDir;
}

async function errorsFor(siteDir) {
  return validateSites({ rootDir: ROOT, siteDirs: [siteDir], checkExtension: false });
}

function output(errors) {
  return errors.map(error => `${error.field} ${error.message}`).join("\n");
}

test.after(async () => {
  await Promise.all(temporaryRoots.map(root => rm(root, { recursive: true, force: true })));
});

test("all repository site packages pass minimal metadata validation", async () => {
  assert.deepEqual(await validateSites({ rootDir: ROOT }), []);
});

test("metadata has exactly five valid fields", async () => {
  const config = configFor();
  delete config.title;
  config.capabilities = {};
  const result = output(await errorsFor(await makeSite({ config })));
  assert.match(result, /must contain exactly/);

  const invalid = configFor("beta");
  invalid.version = "v1";
  invalid.matches = [];
  invalid.runAt = "later";
  const invalidResult = output(await errorsFor(await makeSite({ id: "beta", config: invalid })));
  assert.match(invalidResult, /semantic version/);
  assert.match(invalidResult, /non-empty array/);
  assert.match(invalidResult, /document_start/);
});

test("missing or malformed JSON metadata fails without importing site code", async () => {
  const malformed = await makeSite();
  await writeFile(path.join(malformed, "site.config.json"), "{ not json");
  assert.match(output(await errorsFor(malformed)), /cannot load JSON metadata/);

  const missing = await makeSite({ id: "beta" });
  await rm(path.join(missing, "site.config.json"));
  assert.match(output(await errorsFor(missing)), /cannot load JSON metadata/);
});

test("match patterns require scoped HTTPS registrable hosts", () => {
  assert.match(internals.parseMatchPattern("http://www.alpha.com/*").error, /HTTPS/);
  assert.match(internals.parseMatchPattern("https://*\/*").error, /concrete registrable host/);
  assert.match(internals.parseMatchPattern("https://*.co.uk/*").error, /registrable domain/);
  assert.deepEqual(internals.parseMatchPattern("https://*.alpha.co.uk/products/*"), { host: "alpha.co.uk" });
});

test("directory, package name, README, and config-backed manifest are required", async () => {
  const siteDir = await makeSite();
  await writeFile(path.join(siteDir, "site.config.json"), JSON.stringify(configFor("beta")));
  await writeFile(path.join(siteDir, "package.json"), JSON.stringify({ name: "wrong" }));
  await rm(path.join(siteDir, "README.md"));
  await writeFile(path.join(siteDir, "src/index.ts"), "export default {};\n");
  const result = output(await errorsFor(siteDir));
  assert.match(result, /must match directory/);
  assert.match(result, /@openwebmcp\/site-beta/);
  assert.match(result, /README is required/);
  assert.match(result, /must derive id, title, version, and matches/);
  assert.match(result, /default defineSite export/);
});

test("registered tool names are unique and use the derived site prefix", async () => {
  const wrongPrefix = await makeSite({ toolName: "wrong_read" });
  assert.match(output(await errorsFor(wrongPrefix)), /must use prefix "alpha_"/);

  const root = await mkdtemp(path.join(os.tmpdir(), "openwebmcp-minimal-duplicates-"));
  temporaryRoots.push(root);
  const firstParent = path.join(root, "one");
  const secondParent = path.join(root, "two");
  await mkdir(firstParent, { recursive: true });
  await mkdir(secondParent, { recursive: true });
  const first = await makeSite({ parent: firstParent });
  const second = await makeSite({ parent: secondParent });
  const result = output(await validateSites({ rootDir: ROOT, siteDirs: [first, second], checkExtension: false }));
  assert.match(result, /duplicate site ID/);
  assert.match(result, /duplicate tool name/);
});

test("manual extension wiring drift is detected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openwebmcp-minimal-extension-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "packages/extension/scripts"), { recursive: true });
  await mkdir(path.join(root, "packages/extension/src/sites"), { recursive: true });
  await writeFile(path.join(root, "packages/extension/manifest.json"), JSON.stringify({
    content_scripts: [
      { matches: ["https://wrong.example/*"], js: ["bridge.js"] },
      { matches: ["https://wrong.example/*"], js: ["sites/alpha.js"], run_at: "document_start" }
    ]
  }));
  await writeFile(path.join(root, "packages/extension/scripts/build.mjs"), "export {};\n");
  await writeFile(path.join(root, "packages/extension/package.json"), JSON.stringify({ dependencies: {} }));
  await writeFile(path.join(root, "packages/extension/src/sites/alpha.ts"), "export {};\n");
  const result = output(await internals.validateExtension(root, [{ config: configFor() }]));
  assert.match(result, /matches drifted/);
  assert.match(result, /run_at must be/);
  assert.match(result, /missing "sites\/alpha"/);
  assert.match(result, /missing @openwebmcp\/site-alpha/);
  assert.match(result, /must import and mount/);
  assert.match(result, /bridge matches drifted/);
});

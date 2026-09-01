#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitesDir = path.join(rootDir, "packages/sites");

// TODO: Remove each exception when its site migration issue adds offline coverage.
const siteTestExceptions = new Map([
  ["@openwebmcp/site-amazon", "#19"],
  ["@openwebmcp/site-producthunt", "#20"],
  ["@openwebmcp/site-linkedin", "#25"],
  ["@openwebmcp/site-reddit", "#26"]
]);

const entries = await readdir(sitesDir, { withFileTypes: true });
const seenExceptions = new Set();
let invalid = false;

for (const entry of entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const packageFile = path.join(sitesDir, entry.name, "package.json");
  const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
  const issue = siteTestExceptions.get(packageJson.name);

  if (packageJson.scripts?.test) {
    if (issue) {
      console.error(`${packageJson.name}: remove stale test exception ${issue}`);
      invalid = true;
    }
    continue;
  }

  if (issue) {
    seenExceptions.add(packageJson.name);
    console.log(`TODO ${issue}: ${packageJson.name} does not yet have offline test coverage.`);
  } else {
    console.error(`${packageJson.name}: missing test script and temporary exception`);
    invalid = true;
  }
}

for (const [packageName, issue] of siteTestExceptions) {
  if (!seenExceptions.has(packageName)) {
    console.error(`${packageName}: test exception ${issue} does not match a site without tests`);
    invalid = true;
  }
}

if (invalid) process.exit(1);

const result = spawnSync("npm", ["run", "test", "--workspaces", "--if-present"], {
  cwd: rootDir,
  stdio: "inherit"
});
process.exit(result.status ?? 1);

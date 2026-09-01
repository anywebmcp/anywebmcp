#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitesDir = path.join(rootDir, "packages/sites");

const entries = await readdir(sitesDir, { withFileTypes: true });
let invalid = false;

for (const entry of entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const packageFile = path.join(sitesDir, entry.name, "package.json");
  const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
  if (!packageJson.scripts?.test) {
    console.error(`${packageJson.name}: missing test script`);
    invalid = true;
  }
}

if (invalid) process.exit(1);

const result = spawnSync("npm", ["run", "test", "--workspaces", "--if-present"], {
  cwd: rootDir,
  stdio: "inherit"
});
process.exit(result.status ?? 1);

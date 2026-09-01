#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";

const packageDirectory = process.cwd();
const testDirectory = path.join(packageDirectory, "test");
const entries = (await readdir(testDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /\.test\.(?:[cm]?js|ts)$/.test(entry.name))
  .map(entry => path.join(testDirectory, entry.name))
  .sort();

if (!entries.length) {
  console.error(`No test/*.test.{ts,js,mjs,cjs} files found in ${packageDirectory}.`);
  process.exitCode = 1;
} else {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "anywebmcp-tests-"));
  try {
    await build({
      bundle: true,
      entryPoints: entries,
      entryNames: "[name]",
      format: "esm",
      outdir: outputDirectory,
      outExtension: { ".js": ".mjs" },
      platform: "node",
      sourcemap: "inline",
      target: "node20"
    });
    const tests = entries.map(entry => path.join(
      outputDirectory,
      `${path.basename(entry).replace(/\.(?:[cm]?js|ts)$/, "")}.mjs`
    ));
    const result = spawnSync(process.execPath, ["--test", ...tests], {
      cwd: packageDirectory,
      stdio: "inherit"
    });
    process.exitCode = result.status ?? 1;
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

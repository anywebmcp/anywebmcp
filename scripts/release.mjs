#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "packages/extension/manifest.json");
const launcherCli = resolve(repoRoot, "packages/codex-launcher/bin/openwebmcp-codex.mjs");
const releasesDir = resolve(repoRoot, "dist/releases");

main().catch(error => {
  console.error(`\nRelease failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const version = await selectVersion(manifest.version, options);
  const suffix = options.local ? "-local" : "";
  const finalDir = resolve(releasesDir, `${version}${suffix}`);

  if (process.platform !== "darwin") throw new Error("The complete release requires macOS for the Codex launcher.");
  if (!options.local) await requireCleanWorktree();
  if (await exists(finalDir)) {
    if (!options.overwrite) throw new Error(`${finalDir} already exists. Pass --overwrite to replace it.`);
  }

  if (manifest.version !== version) {
    manifest.version = version;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Version: ${version} (updated packages/extension/manifest.json)`);
  } else {
    console.log(`Version: ${version}`);
  }

  await mkdir(releasesDir, { recursive: true });
  const stagingDir = await mkdtemp(resolve(releasesDir, ".release-"));
  try {
    await runChecks();
    const artifacts = await buildArtifacts(stagingDir, version, options.local);
    await validateArtifacts(artifacts, version);
    await rm(resolve(stagingDir, "work"), { force: true, recursive: true });
    if (options.overwrite) await rm(finalDir, { force: true, recursive: true });
    await rename(stagingDir, finalDir);
    printSummary(finalDir, artifacts.map(path => path.split("/").pop()));
  } catch (error) {
    await rm(stagingDir, { force: true, recursive: true });
    throw error;
  }
}

async function runChecks() {
  await run("npm", ["run", "typecheck"]);
  await run("npm", ["run", "validate:sites"]);
  await run("npm", ["test"]);
  await run("git", ["diff", "--check"]);
}

async function buildArtifacts(stagingDir, version, local) {
  const workDir = resolve(stagingDir, "work");
  const extensionDir = resolve(workDir, "extension");
  await mkdir(workDir, { recursive: true });

  await run("npm", ["run", "build", "-w", "@openwebmcp/extension", "--", `--outdir=${extensionDir}`]);
  await validateExtension(extensionDir, version);

  const manualZip = resolve(stagingDir, `openwebmcp-extension-${version}.zip`);
  const storeZip = resolve(stagingDir, `openwebmcp-chrome-web-store-${version}.zip`);
  const launcherZip = resolve(stagingDir, `codex-webmcp-macos-universal-${version}${local ? "-local" : ""}.zip`);

  await packageManualExtension(workDir, extensionDir, manualZip, version);
  await zipDirectory(extensionDir, storeZip);
  await buildLauncher(workDir, extensionDir, launcherZip, local);
  return [manualZip, storeZip, launcherZip];
}

async function packageManualExtension(workDir, extensionDir, output, version) {
  const parent = resolve(workDir, "manual");
  const directoryName = `OpenWebMCP-${version}`;
  await mkdir(parent, { recursive: true });
  await cp(extensionDir, resolve(parent, directoryName), { recursive: true });
  await createZip(parent, directoryName, output);
}

async function zipDirectory(directory, output) {
  await createZip(directory, ".", output);
}

async function createZip(cwd, input, output) {
  await rm(output, { force: true });
  await run("/usr/bin/zip", ["-qry", output, input], cwd);
}

async function buildLauncher(workDir, extensionDir, output, local) {
  const appPath = resolve(workDir, "launcher/Codex WebMCP.app");
  const args = [launcherCli, "build", "--mode=bundle", `--extension-dir=${extensionDir}`, `--output=${appPath}`];
  args.push(local ? "--archive" : "--notarize");
  await run("node", args);
  await rename(resolve(workDir, "launcher/Codex WebMCP.zip"), output);
}

async function validateExtension(directory, version) {
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  if (manifest.version !== version) throw new Error("The built extension version does not match the release version.");

  const files = await filesUnder(directory);
  const unwanted = files.find(path => path.endsWith(".DS_Store") || path.endsWith(".ts") || path.includes("node_modules/"));
  if (unwanted) throw new Error(`Unexpected extension file: ${unwanted}`);

  const scripts = manifest.content_scripts ?? [];
  const referenced = [manifest.background?.service_worker, ...scripts.flatMap(script => script.js ?? [])].filter(Boolean);
  for (const path of referenced) {
    if (!files.includes(path)) throw new Error(`The extension manifest references missing file ${path}.`);
  }
}

async function validateArtifacts([manualZip, storeZip, launcherZip], version) {
  for (const path of [manualZip, storeZip, launcherZip]) await run("/usr/bin/unzip", ["-tqq", path]);

  const manualEntries = await zipEntries(manualZip);
  if (!manualEntries.includes(`OpenWebMCP-${version}/manifest.json`)) {
    throw new Error("The manual extension ZIP does not contain its versioned extension directory.");
  }

  const storeEntries = await zipEntries(storeZip);
  if (!storeEntries.includes("manifest.json")) throw new Error("The Chrome Web Store ZIP must contain manifest.json at its root.");
  if (storeEntries.some(path => path.startsWith(`OpenWebMCP-${version}/`))) {
    throw new Error("The Chrome Web Store ZIP must not contain a parent directory.");
  }

  const { stdout } = await exec("/usr/bin/unzip", [
    "-p", launcherZip, "Codex WebMCP.app/Contents/Resources/extension/manifest.json"
  ]);
  const embeddedManifest = JSON.parse(stdout);
  if (embeddedManifest.version !== version) throw new Error("The launcher contains the wrong extension version.");
}

async function zipEntries(path) {
  const { stdout } = await exec("/usr/bin/unzip", ["-Z1", path]);
  return stdout.split("\n").filter(Boolean);
}

async function filesUnder(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    if ((await stat(path)).isDirectory()) files.push(...await filesUnder(root, path));
    else files.push(path.slice(root.length + 1));
  }
  return files;
}

async function requireCleanWorktree() {
  const { stdout } = await exec("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (stdout.trim()) throw new Error("Commit or stash tracked and untracked changes before a production release.");
}

async function selectVersion(current, options) {
  if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error(`Unsupported current version: ${current}`);
  if (options.version && options.bump) throw new Error("Use either --version or --bump, not both.");

  let selected = options.version;
  if (options.bump) selected = bumpVersion(current, options.bump);
  if (!selected) selected = await promptVersion(current);
  if (!/^\d+\.\d+\.\d+$/.test(selected)) throw new Error(`Version must use major.minor.patch: ${selected}`);
  if (compareVersions(selected, current) < 0) throw new Error(`Version ${selected} is older than ${current}.`);
  return selected;
}

async function promptVersion(current) {
  if (!process.stdin.isTTY) throw new Error("Pass --bump=patch|minor|major or --version=x.y.z.");
  const choices = ["patch", "minor", "major"];
  const next = choices.map(value => bumpVersion(current, value));
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question(
    `Current version: ${current}\n1. Patch: ${next[0]}\n2. Minor: ${next[1]}\n3. Major: ${next[2]}\n4. Exact version\nSelect: `
  );
  let selected = next[Number(answer) - 1];
  if (answer === "4") selected = await readline.question("Version: ");
  readline.close();
  if (!selected) throw new Error("No release version was selected.");
  return selected.trim();
}

function bumpVersion(version, bump) {
  const parts = version.split(".").map(Number);
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  if (index === undefined) throw new Error(`Unsupported bump: ${bump}`);
  parts[index] += 1;
  for (let next = index + 1; next < parts.length; next += 1) parts[next] = 0;
  return parts.join(".");
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function parseOptions(args) {
  const options = { local: false, overwrite: false };
  for (let index = 0; index < args.length; index += 1) {
    const [name, inline] = args[index].split("=", 2);
    if (name === "--local" || name === "--overwrite") options[name.slice(2)] = true;
    else if (name === "--version" || name === "--bump") options[name.slice(2)] = inline ?? args[++index];
    else throw new Error(`Unknown release option: ${args[index]}`);
  }
  return options;
}

function run(command, args, cwd = repoRoot) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function printSummary(directory, names) {
  console.log(`\nRelease artifacts: ${directory}`);
  for (const name of names) console.log(`- ${name}`);
}

import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { checkNotaryProfile, notarizeApp, resolveSigningIdentity, signApp } from "./signing.mjs";

const exec = promisify(execFile);

export async function buildApp(options, targetPath) {
  await validateInputs(options);
  const identity = await resolveSigningIdentity(options);
  if (options.notarize) await checkNotaryProfile(options.notaryProfile);
  await mkdir(dirname(targetPath), { recursive: true });
  const stagingDir = await mkdtemp(resolve(dirname(targetPath), ".codex-webmcp-"));
  const stagedPath = resolve(stagingDir, basename(targetPath));

  try {
    await mkdir(resolve(stagedPath, "Contents/MacOS"), { recursive: true });
    await mkdir(resolve(stagedPath, "Contents/Resources"), { recursive: true });
    const extensionValue = await prepareExtension(options, stagedPath);
    await writeTemplates(options, stagedPath, extensionValue);
    await copyIcon(options, stagedPath);
    await signApp(stagedPath, identity);
    if (options.notarize) {
      await notarizeApp(stagedPath, await archiveApp(stagedPath), options.notaryProfile);
    }

    await rm(targetPath, { force: true, recursive: true });
    await rename(stagedPath, targetPath);
    return targetPath;
  } finally {
    await rm(stagingDir, { force: true, recursive: true });
  }
}

export async function archiveApp(appPath) {
  const archivePath = appPath.endsWith(".app") ? `${appPath.slice(0, -4)}.zip` : `${appPath}.zip`;
  await rm(archivePath, { force: true });
  await exec("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, archivePath]);
  return archivePath;
}

async function validateInputs(options) {
  if (process.platform !== "darwin") throw new Error("Codex launcher generation currently supports macOS only.");
  await access(resolve(options.sourceApp, "Contents/MacOS/ChatGPT"));
  await access(resolve(options.extensionDir, "manifest.json"));
}

async function prepareExtension(options, appPath) {
  if (options.mode === "dev") return shellQuote(options.extensionDir);

  const destination = resolve(appPath, "Contents/Resources/extension");
  await cp(options.extensionDir, destination, { recursive: true });
  return '"$resources_dir/extension"';
}

async function writeTemplates(options, appPath, extensionValue) {
  const templateDir = resolve(options.packageRoot, "templates");
  const executableName = "Codex WebMCP Launcher";
  const plist = applyTemplate(await readFile(resolve(templateDir, "Info.plist"), "utf8"), {
    APP_NAME: options.appName,
    BUNDLE_ID: options.bundleId,
    EXECUTABLE_NAME: executableName
  });
  const launcher = applyTemplate(await readFile(resolve(templateDir, "launcher.zsh"), "utf8"), {
    EXTENSION_DIR: extensionValue,
    PROFILE_DIR: profileValue(options.profile),
    SOURCE_APP: shellQuote(options.sourceApp)
  });

  const plistPath = resolve(appPath, "Contents/Info.plist");
  const executablePath = resolve(appPath, `Contents/MacOS/${executableName}`);
  await writeFile(plistPath, plist);
  await writeFile(resolve(appPath, "Contents/Resources/launcher.zsh"), launcher);
  await exec("/usr/bin/xcrun", [
    "clang", "-arch", "arm64", "-arch", "x86_64", "-mmacosx-version-min=13.0",
    "-Os", "-Wall", "-Wextra", resolve(templateDir, "launcher.c"), "-o", executablePath
  ]);
  await exec("/usr/bin/plutil", ["-lint", plistPath]);
}

async function copyIcon(options, appPath) {
  const source = resolve(options.sourceApp, "Contents/Resources/app.icns");
  const destination = resolve(appPath, "Contents/Resources/CodexWebMCP.icns");
  await cp(source, destination);
}

function applyTemplate(template, values) {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`__${name}__`, value),
    template
  );
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function profileValue(profile) {
  const directory = profile === "isolated" ? "Codex-WebMCP/Profile" : "Codex";
  return `"$HOME/Library/Application Support/${directory}"`;
}

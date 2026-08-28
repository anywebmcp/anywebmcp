import { execFile } from "node:child_process";
import { access, chmod, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function buildApp(options, targetPath) {
  const stagedPath = `${targetPath}.building`;
  await validateInputs(options);
  await rm(stagedPath, { force: true, recursive: true });
  await mkdir(resolve(stagedPath, "Contents/MacOS"), { recursive: true });
  await mkdir(resolve(stagedPath, "Contents/Resources"), { recursive: true });

  const extensionValue = await prepareExtension(options, stagedPath);
  await writeTemplates(options, stagedPath, extensionValue);
  await copyIcon(options, stagedPath);
  await signApp(stagedPath);

  await mkdir(dirname(targetPath), { recursive: true });
  await rm(targetPath, { force: true, recursive: true });
  await rename(stagedPath, targetPath);
  return targetPath;
}

export async function verifyApp(appPath) {
  await exec("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
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
    PROFILE_DIR: profileValue(options.mode),
    SOURCE_APP: shellQuote(options.sourceApp)
  });

  const plistPath = resolve(appPath, "Contents/Info.plist");
  const executablePath = resolve(appPath, `Contents/MacOS/${executableName}`);
  await writeFile(plistPath, plist);
  await writeFile(executablePath, launcher);
  await chmod(executablePath, 0o755);
  await exec("/usr/bin/plutil", ["-lint", plistPath]);
}

async function copyIcon(options, appPath) {
  const source = resolve(options.sourceApp, "Contents/Resources/app.icns");
  const destination = resolve(appPath, "Contents/Resources/CodexWebMCP.icns");
  await cp(source, destination);
}

async function signApp(appPath) {
  await exec("/usr/bin/codesign", ["--force", "--sign", "-", appPath]);
  await verifyApp(appPath);
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

function profileValue(mode) {
  const directory = mode === "dev" ? "Codex-WebMCP/Profile" : "Codex";
  return `"$HOME/Library/Application Support/${directory}"`;
}

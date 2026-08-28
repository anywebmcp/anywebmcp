import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { archiveApp, buildApp, verifyApp } from "./app-bundle.mjs";
import { parseOptions } from "./options.mjs";

const exec = promisify(execFile);

export async function run(argv) {
  const options = parseOptions(argv);

  switch (options.command) {
    case "build":
      await build(options, options.outputPath);
      break;
    case "install":
      await build(options, options.installPath);
      if (options.open) await open(options.installPath);
      break;
    case "open":
      await open(options.installPath);
      break;
    case "doctor":
      await doctor(options);
      break;
    case "help":
    case "--help":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${options.command}`);
  }
}

async function build(options, targetPath) {
  const appPath = await buildApp(options, targetPath);
  console.log(`Generated ${appPath}`);
  console.log(options.mode === "bundle" ? "Extension mode: bundled" : `Extension mode: development (${options.extensionDir})`);
  console.log(options.mode === "bundle" ? "User data: standard Codex profile" : "User data: isolated development profile");
  if (options.archive) console.log(`Archived ${await archiveApp(appPath)}`);
}

async function open(appPath) {
  await access(appPath);
  await exec("/usr/bin/open", ["-n", appPath]);
  console.log(`Opened ${appPath}`);
}

async function doctor(options) {
  const checks = [
    ["macOS", process.platform === "darwin"],
    ["Codex app", await exists(`${options.sourceApp}/Contents/MacOS/ChatGPT`)],
    ["Extension build", await exists(`${options.extensionDir}/manifest.json`)],
    ["Installed launcher", await exists(options.installPath)]
  ];

  for (const [name, passed] of checks) console.log(`${passed ? "✓" : "✗"} ${name}`);
  if (!checks.every(([, passed]) => passed)) {
    process.exitCode = 1;
    return;
  }

  await verifyApp(options.installPath);
  console.log("✓ Launcher signature");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`Usage: openwebmcp-codex <command> [options]

Commands:
  build      Generate a launcher app in packages/codex-launcher/dist
  install    Generate a launcher app in ~/Applications
  open       Open the installed launcher
  doctor     Check Codex, extension, launcher, and signing prerequisites

Options:
  --mode=dev|bundle       Reference an external extension or embed it
  --extension-dir=<path>  Extension directory containing manifest.json
  --source-app=<path>     Codex app bundle (default: /Applications/ChatGPT.app)
  --output=<path>         Output path for build
  --install-dir=<path>    Parent directory for install
  --archive               Create a transfer-safe ZIP beside the app
  --open                  Open the launcher after install
`);
}

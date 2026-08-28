import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

export function parseOptions(argv) {
  const [command = "help", ...args] = argv;
  const flags = parseFlags(args);
  const mode = flags.mode ?? "bundle";

  if (!new Set(["bundle", "dev"]).has(mode)) {
    throw new Error(`Unsupported launcher mode: ${mode}`);
  }

  const appName = "Codex WebMCP";
  const installDir = resolve(flags["install-dir"] ?? `${homedir()}/Applications`);

  return {
    appName,
    archive: flags.archive === true,
    bundleId: "dev.openwebmcp.codex-launcher",
    command,
    extensionDir: resolve(flags["extension-dir"] ?? `${repoRoot}/packages/extension/dist`),
    installPath: resolve(installDir, `${appName}.app`),
    mode,
    open: flags.open === true,
    outputPath: resolve(flags.output ?? `${packageRoot}/dist/${appName}.app`),
    packageRoot,
    repoRoot,
    sourceApp: resolve(flags["source-app"] ?? "/Applications/ChatGPT.app")
  };
}

function parseFlags(args) {
  const flags = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);

    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawName] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawName] = next;
      index += 1;
    } else {
      flags[rawName] = true;
    }
  }

  return flags;
}

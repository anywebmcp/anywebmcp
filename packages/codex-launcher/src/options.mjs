import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

export function parseOptions(argv) {
  const [command = "help", ...args] = argv;
  const flags = parseFlags(args);
  const mode = flags.mode ?? "bundle";
  const profile = flags.profile ?? (mode === "bundle" ? "standard" : "isolated");
  const notarize = flags.notarize === true;

  if (!new Set(["bundle", "dev"]).has(mode)) {
    throw new Error(`Unsupported launcher mode: ${mode}`);
  }
  if (!new Set(["standard", "isolated"]).has(profile)) {
    throw new Error(`Unsupported profile mode: ${profile}`);
  }
  if (notarize && mode !== "bundle") {
    throw new Error("Notarization requires --mode=bundle so the extension is included in the app.");
  }

  const appName = "Codex WebMCP";
  const installDir = resolve(flags["install-dir"] ?? `${homedir()}/Applications`);

  return {
    appName,
    archive: flags.archive === true || notarize,
    bundleId: "dev.openwebmcp.codex-launcher",
    command,
    extensionDir: resolve(flags["extension-dir"] ?? `${repoRoot}/packages/extension/dist`),
    installPath: resolve(installDir, `${appName}.app`),
    mode,
    notarize,
    notaryProfile: flags["notary-profile"] ?? process.env.APPLE_NOTARY_PROFILE ?? "openwebmcp",
    open: flags.open === true,
    outputPath: resolve(flags.output ?? `${packageRoot}/dist/${appName}.app`),
    packageRoot,
    profile,
    repoRoot,
    signed: flags.signed === true || notarize || flags["signing-identity"] !== undefined,
    signingIdentity: flags["signing-identity"] ?? process.env.APPLE_SIGNING_IDENTITY,
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

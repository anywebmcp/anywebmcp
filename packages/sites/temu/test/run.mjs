import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = await mkdtemp(join(tmpdir(), "openwebmcp-temu-tests-"));
const outfile = join(directory, "temu-tests.mjs");

try {
  await build({
    bundle: true,
    entryPoints: [fileURLToPath(new URL("all.test.ts", import.meta.url))],
    format: "esm",
    outfile,
    platform: "node",
    sourcemap: "inline",
    target: "node20"
  });
  const result = spawnSync(process.execPath, ["--test", outfile], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { force: true, recursive: true });
}

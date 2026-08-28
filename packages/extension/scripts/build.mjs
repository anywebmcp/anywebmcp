import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const outdir = new URL("../dist/", import.meta.url).pathname;

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await build({
  bundle: true,
  entryPoints: {
    background: "src/background.ts",
    bridge: "src/bridge.ts",
    "sites/linkedin": "src/sites/linkedin.ts",
    "sites/x": "src/sites/x.ts"
  },
  format: "esm",
  outdir,
  platform: "browser",
  target: "chrome120"
});

await cp("manifest.json", `${outdir}/manifest.json`);

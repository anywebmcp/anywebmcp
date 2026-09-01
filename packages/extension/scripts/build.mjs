import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outdir = resolve(option("outdir") ?? new URL("../dist/", import.meta.url).pathname);

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await build({
  bundle: true,
  entryPoints: {
    background: "src/background.ts",
    bridge: "src/bridge.ts",
    "sites/amazon": "src/sites/amazon.ts",
    "sites/ebay": "src/sites/ebay.ts",
    "sites/hackernews": "src/sites/hackernews.ts",
    "sites/linkedin": "src/sites/linkedin.ts",
    "sites/producthunt": "src/sites/producthunt.ts",
    "sites/temu": "src/sites/temu.ts",
    "sites/reddit": "src/sites/reddit.ts",
    "sites/x": "src/sites/x.ts"
  },
  format: "esm",
  outdir,
  platform: "browser",
  target: "chrome120"
});

await cp("manifest.json", `${outdir}/manifest.json`);
await cp("icons", `${outdir}/icons`, { recursive: true });
await cp("../../LICENSE", `${outdir}/LICENSE`);
await cp("../../NOTICE", `${outdir}/NOTICE`);

function option(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find(argument => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

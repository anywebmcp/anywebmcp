#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSiteDirectories, formatDiagnostics, validateSites } from "./site-config/validator.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteFlag = process.argv.indexOf("--site");
const siteDirs = siteFlag === -1 ? undefined : [path.resolve(process.cwd(), process.argv[siteFlag + 1] ?? "")];

const errors = await validateSites({ rootDir, siteDirs });
if (errors.length) {
  console.error(formatDiagnostics(errors));
  process.exitCode = 1;
} else {
  const count = siteDirs?.length ?? (await discoverSiteDirectories(rootDir)).length;
  console.log(`Validated ${count} site package${count === 1 ? "" : "s"}.`);
}

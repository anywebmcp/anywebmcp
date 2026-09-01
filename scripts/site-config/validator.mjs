import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseDomain } from "tldts";
import ts from "typescript";

const CONFIG_FIELDS = ["id", "matches", "runAt", "title", "version"];
const RUN_AT_VALUES = new Set(["document_start", "document_end", "document_idle"]);

function diagnostic(rootDir, file, field, message) {
  const relative = path.relative(rootDir, file);
  return {
    file: relative && !relative.startsWith("..") ? relative : file,
    field,
    message
  };
}

async function pathExists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(rootDir, file, errors) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(diagnostic(rootDir, file, "", `cannot load JSON metadata: ${error.message}`));
    return null;
  }
}

function validateConfigShape(rootDir, file, config, errors) {
  const errorCount = errors.length;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    errors.push(diagnostic(rootDir, file, "", "metadata must be a JSON object"));
    return false;
  }

  const keys = Object.keys(config).sort();
  if (keys.join("\0") !== CONFIG_FIELDS.join("\0")) {
    errors.push(diagnostic(rootDir, file, "", `metadata must contain exactly: ${CONFIG_FIELDS.join(", ")}`));
    return false;
  }
  if (typeof config.id !== "string" || !/^[a-z][a-z0-9]*$/.test(config.id)) {
    errors.push(diagnostic(rootDir, file, "id", "must be a lowercase alphanumeric site ID"));
  }
  if (typeof config.title !== "string" || !config.title.trim()) {
    errors.push(diagnostic(rootDir, file, "title", "must be a non-empty string"));
  }
  if (typeof config.version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(config.version)) {
    errors.push(diagnostic(rootDir, file, "version", "must be a semantic version"));
  }
  if (!Array.isArray(config.matches) || config.matches.length === 0 || config.matches.some(value => typeof value !== "string")) {
    errors.push(diagnostic(rootDir, file, "matches", "must be a non-empty array of strings"));
  } else if (new Set(config.matches).size !== config.matches.length) {
    errors.push(diagnostic(rootDir, file, "matches", "must not contain duplicates"));
  }
  if (!RUN_AT_VALUES.has(config.runAt)) {
    errors.push(diagnostic(rootDir, file, "runAt", "must be document_start, document_end, or document_idle"));
  }
  return errors.length === errorCount;
}

function parseMatchPattern(pattern) {
  const match = /^https:\/\/([^/:?#]+)(\/[^?#]*)$/.exec(pattern);
  if (!match) return { error: "must be an HTTPS match pattern without a port, query, or fragment" };

  const rawHost = match[1].toLowerCase();
  const wildcard = rawHost.startsWith("*.");
  const host = wildcard ? rawHost.slice(2) : rawHost;
  if (rawHost === "*" || host.includes("*") || !host.includes(".")) {
    return { error: "must target a concrete registrable host" };
  }
  const parsed = parseDomain(host, { allowPrivateDomains: true });
  if (!parsed.domain || parsed.hostname !== host) {
    return { error: "must target a valid host with a registrable domain" };
  }
  return { host };
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

async function readToolName(moduleFile, exportName) {
  const source = await readFile(moduleFile, "utf8");
  const sourceFile = ts.createSourceFile(moduleFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) continue;
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) break;
      const nameProperty = declaration.initializer.properties.find(property =>
        ts.isPropertyAssignment(property) && propertyName(property.name) === "name"
      );
      if (nameProperty && ts.isPropertyAssignment(nameProperty) && ts.isStringLiteral(nameProperty.initializer)) {
        return nameProperty.initializer.text;
      }
      throw new Error(`export ${exportName} must declare a literal name`);
    }
  }
  throw new Error(`export ${exportName} was not found`);
}

function resolveToolModule(indexFile, specifier) {
  const base = path.resolve(path.dirname(indexFile), specifier);
  return specifier.endsWith(".ts") ? base : `${base}.ts`;
}

async function readRegisteredToolNames(indexFile) {
  const source = await readFile(indexFile, "utf8");
  const sourceFile = ts.createSourceFile(indexFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.startsWith(".")) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      imports.set(element.name.text, {
        exportName: element.propertyName?.text ?? element.name.text,
        moduleFile: resolveToolModule(indexFile, statement.moduleSpecifier.text)
      });
    }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement) || !ts.isCallExpression(statement.expression)) continue;
    const call = statement.expression;
    if (!ts.isIdentifier(call.expression) || call.expression.text !== "defineSite") continue;
    const definition = call.arguments[0];
    if (!definition || !ts.isObjectLiteralExpression(definition)) break;
    const toolsProperty = definition.properties.find(property =>
      ts.isPropertyAssignment(property) && propertyName(property.name) === "tools"
    );
    if (!toolsProperty || !ts.isPropertyAssignment(toolsProperty) || !ts.isArrayLiteralExpression(toolsProperty.initializer)) break;

    const names = [];
    for (const element of toolsProperty.initializer.elements) {
      if (!ts.isIdentifier(element)) throw new Error("registered tools must be imported identifiers");
      const imported = imports.get(element.text);
      if (!imported) throw new Error(`registered tool ${element.text} must be a named relative import`);
      names.push(await readToolName(imported.moduleFile, imported.exportName));
    }
    return names;
  }
  throw new Error("default defineSite export with a literal tools array was not found");
}

function sameStringSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function validateSite({ rootDir, siteDir, siteIds, toolNames }) {
  const errors = [];
  const configFile = path.join(siteDir, "site.config.json");
  const config = await readJson(rootDir, configFile, errors);
  if (!config || !validateConfigShape(rootDir, configFile, config, errors)) return { config: null, errors };

  const directoryId = path.basename(siteDir);
  if (config.id !== directoryId) {
    errors.push(diagnostic(rootDir, configFile, "id", `must match directory ${JSON.stringify(directoryId)}`));
  }
  if (siteIds.has(config.id)) {
    errors.push(diagnostic(rootDir, configFile, "id", `duplicate site ID ${JSON.stringify(config.id)}`));
  }
  siteIds.add(config.id);

  if (Array.isArray(config.matches)) {
    config.matches.forEach((pattern, index) => {
      if (typeof pattern !== "string") return;
      const parsed = parseMatchPattern(pattern);
      if (parsed.error) errors.push(diagnostic(rootDir, configFile, `matches[${index}]`, parsed.error));
    });
  }

  const packageFile = path.join(siteDir, "package.json");
  const packageJson = await readJson(rootDir, packageFile, errors);
  const expectedPackageName = `@anywebmcp/site-${config.id}`;
  if (packageJson && packageJson.name !== expectedPackageName) {
    errors.push(diagnostic(rootDir, packageFile, "name", `must be ${JSON.stringify(expectedPackageName)}`));
  }

  const readmeFile = path.join(siteDir, "README.md");
  if (!(await pathExists(readmeFile))) {
    errors.push(diagnostic(rootDir, readmeFile, "", "README is required"));
  }

  const indexFile = path.join(siteDir, "src/index.ts");
  if (!(await pathExists(indexFile))) {
    errors.push(diagnostic(rootDir, indexFile, "", "site package entry point is required"));
  } else {
    const indexSource = await readFile(indexFile, "utf8");
    const projections = ["id", "title", "version", "matches"];
    if (!indexSource.includes("site.config.json") || projections.some(field => !indexSource.includes(`${field}: siteConfig.${field}`))) {
      errors.push(diagnostic(rootDir, indexFile, "manifest", "must derive id, title, version, and matches from site.config.json"));
    }
    try {
      for (const name of await readRegisteredToolNames(indexFile)) {
        if (!name.startsWith(`${config.id}_`)) {
          errors.push(diagnostic(rootDir, indexFile, "tools", `tool ${JSON.stringify(name)} must use prefix ${JSON.stringify(`${config.id}_`)}`));
        }
        if (toolNames.has(name)) {
          errors.push(diagnostic(rootDir, indexFile, "tools", `duplicate tool name ${JSON.stringify(name)}`));
        }
        toolNames.add(name);
      }
    } catch (error) {
      errors.push(diagnostic(rootDir, indexFile, "tools", error.message));
    }
  }

  return { config, errors };
}

async function validateExtension(rootDir, results) {
  const errors = [];
  const manifestFile = path.join(rootDir, "packages/extension/manifest.json");
  const manifest = await readJson(rootDir, manifestFile, errors);
  if (!manifest) return errors;
  const buildFile = path.join(rootDir, "packages/extension/scripts/build.mjs");
  const buildSource = await readFile(buildFile, "utf8");
  const extensionPackageFile = path.join(rootDir, "packages/extension/package.json");
  const extensionPackage = await readJson(rootDir, extensionPackageFile, errors);
  const bridgeMatches = new Set();

  for (const { config } of results) {
    if (!config) continue;
    config.matches.forEach(pattern => bridgeMatches.add(pattern));
    const contentScript = manifest.content_scripts?.find(entry =>
      entry.js?.length === 1 && entry.js[0] === `sites/${config.id}.js`
    );
    if (!contentScript) {
      errors.push(diagnostic(rootDir, manifestFile, "content_scripts", `missing content script for ${config.id}`));
    } else {
      if (!sameStringSet(contentScript.matches ?? [], config.matches)) {
        errors.push(diagnostic(rootDir, manifestFile, "content_scripts", `${config.id} matches drifted from site.config.json`));
      }
      if (contentScript.run_at !== config.runAt) {
        errors.push(diagnostic(rootDir, manifestFile, "content_scripts", `${config.id} run_at must be ${JSON.stringify(config.runAt)}`));
      }
    }

    const buildEntry = `"sites/${config.id}": "src/sites/${config.id}.ts"`;
    if (!buildSource.includes(buildEntry)) {
      errors.push(diagnostic(rootDir, buildFile, "entryPoints", `missing ${buildEntry}`));
    }
    if (!extensionPackage?.dependencies?.[`@anywebmcp/site-${config.id}`]) {
      errors.push(diagnostic(rootDir, extensionPackageFile, "dependencies", `missing @anywebmcp/site-${config.id}`));
    }

    const entryFile = path.join(rootDir, `packages/extension/src/sites/${config.id}.ts`);
    if (!(await pathExists(entryFile))) {
      errors.push(diagnostic(rootDir, entryFile, "", "extension site entry is required"));
    } else {
      const entrySource = await readFile(entryFile, "utf8");
      if (!entrySource.includes(`from \"@anywebmcp/site-${config.id}\"`) || !entrySource.includes("mountSite(")) {
        errors.push(diagnostic(rootDir, entryFile, "", `must import and mount @anywebmcp/site-${config.id}`));
      }
    }
  }

  const bridgeScript = manifest.content_scripts?.find(entry => entry.js?.includes("bridge.js"));
  if (!bridgeScript || !sameStringSet(bridgeScript.matches ?? [], [...bridgeMatches])) {
    errors.push(diagnostic(rootDir, manifestFile, "content_scripts", "bridge matches drifted from the site configs"));
  }
  return errors;
}

export async function discoverSiteDirectories(rootDir) {
  const sitesDir = path.join(rootDir, "packages/sites");
  return (await readdir(sitesDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(sitesDir, entry.name))
    .sort();
}

export async function validateSites({ rootDir = process.cwd(), siteDirs, checkExtension = true } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedSites = siteDirs?.map(siteDir => path.resolve(siteDir)) ?? await discoverSiteDirectories(resolvedRoot);
  const siteIds = new Set();
  const toolNames = new Set();
  const results = [];
  for (const siteDir of resolvedSites) {
    results.push(await validateSite({ rootDir: resolvedRoot, siteDir, siteIds, toolNames }));
  }
  const errors = results.flatMap(result => result.errors);
  if (checkExtension && !siteDirs) errors.push(...await validateExtension(resolvedRoot, results));
  return errors;
}

export function formatDiagnostics(errors) {
  return errors.map(error => `${error.file}${error.field ? ` ${error.field}` : ""}: ${error.message}`).join("\n");
}

export const internals = { parseMatchPattern, readRegisteredToolNames, validateExtension };

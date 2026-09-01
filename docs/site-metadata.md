# Site metadata

This document owns the minimal canonical metadata format and repository validation for site packages. Cross-package behavior and safety invariants remain owned by the [site package standard](site-package-standard.md). Extension generation and lifecycle mechanics remain owned by [#16](https://github.com/lugovsky/openwebmcp/issues/16).

## Canonical source

Every package under `packages/sites/*` MUST contain a `site.config.json` with exactly these fields:

```json
{
  "id": "example",
  "title": "Example",
  "version": "0.1.0",
  "matches": ["https://www.example.com/*"],
  "runAt": "document_idle"
}
```

- `id` is the stable lowercase site ID. It MUST match the directory and the `@openwebmcp/site-<id>` package name.
- `title` is the human-readable site title.
- `version` is the site's semantic compatibility or release version.
- `matches` contains unique HTTPS extension match patterns for supported hosts. Broad host patterns are forbidden.
- `runAt` is `document_start`, `document_end`, or `document_idle` and mirrors the extension content script's injection timing.

The metadata file is JSON so loading it cannot execute browser code. Each package entry point MUST use it for `id`, `title`, `version`, and `matches`; those values MUST NOT be copied into the TypeScript manifest.

Tool names, descriptions, input schemas, annotations, page preconditions, safety behavior, external endpoint documentation, and benchmark results remain in their existing owning source files. They are not duplicated in site metadata. The required tool prefix is derived as `<id>_`.

## Validation

Run:

```sh
npm run validate:sites
```

The validator checks:

- the five-field metadata shape;
- unique site IDs and public tool names;
- the `<id>_` tool prefix;
- valid, scoped HTTPS host match patterns;
- directory, package name, and site ID agreement;
- presence of each package README;
- use of metadata by the package entry point; and
- drift between metadata and the manually maintained extension manifest, build entries, dependencies, and site entries.

The validator reads metadata as JSON and statically reads only the names of tools registered by `src/index.ts`. It does not import site packages, execute browser code, inspect tool safety metadata, generate extension wiring, or validate benchmarks. Those responsibilities remain with their existing documents and follow-up issues.

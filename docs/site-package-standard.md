# Site package standard

This document defines the cross-package invariants for every integration under `packages/sites/*`. It deliberately does not define concrete metadata, lifecycle, adapter-result, runtime-helper, test-harness, or benchmark APIs. Those details belong to the sources listed in [Source-of-truth map](#source-of-truth-map).

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are normative. **MUST** and **MUST NOT** state requirements. **SHOULD** and **SHOULD NOT** state defaults that require a documented reason to depart from. **MAY** states an optional choice.

## Responsibility and boundaries

A site package owns the website-specific behavior needed to expose WebMCP tools for one site or a closely related set of site origins. It owns its tool definitions, page preconditions, domain types, selectors, endpoint knowledge, challenge and authentication detection, and UI, official-API, or internal-API adapters.

The extension owns discovery, injection, mounting, and access to extension services. A site package MUST NOT depend on extension implementation details or perform extension wiring at import time.

The common runtime owns contracts and browser operations that have genuinely shared semantics. A site package SHOULD use common contracts and primitives when they fit, but site classification, selectors, interpretation, and business behavior MUST remain local to the site package. The repository MUST NOT introduce a universal DOM abstraction.

## Conceptual module boundaries

Tool-definition modules SHOULD be thin. They declare the WebMCP-facing name, title, description, input schema, annotations, page preconditions, and execution entry point, then delegate website interaction and interpretation to adapters.

Adapters own website-specific DOM, UI, official-API, and internal-API behavior. They SHOULD be independently testable and MUST NOT serialize WebMCP transport responses themselves.

Domain types describe site concepts and adapter data independently of WebMCP response formatting. Shared types MAY be extracted only when their meaning is the same across sites.

These are responsibility boundaries, not mandatory directory names. A package MAY combine trivial modules or add site-specific modules when doing so keeps the ownership clear.

## Pure imports and lifecycle

Importing site metadata or a site package entry point MUST be side-effect free. Import evaluation MUST NOT:

- patch browser globals;
- register tools, event listeners, observers, or timers;
- read or mutate the DOM;
- start network requests; or
- navigate the page.

Browser effects MUST begin only through an explicit lifecycle call made by the extension. The lifecycle function signatures, setup context, registration behavior, and teardown mechanics are owned by [#16](https://github.com/lugovsky/openwebmcp/issues/16).

## Required site information

Each package MUST provide canonical information sufficient to identify and load the integration. The information MUST cover:

- stable site identity and display identity;
- package compatibility or release version;
- supported secure origins;
- injection or browser-runtime needs;
- the tool-name namespace and public tool inventory; and
- documented page contexts or preconditions for each tool.

This standard does not prescribe field names, a file format, or the final metadata schema. Those are owned by [#11](https://github.com/lugovsky/openwebmcp/issues/11).

## Page applicability

Every tool MUST document the page state or context it requires and MUST validate safety-relevant preconditions before acting. Injection on a supported origin alone MUST NOT be treated as proof that a tool can safely run on the current page.

An implementation MAY keep all site tools registered and check preconditions when called, return `navigation_required`, or register a context-specific subset. Dynamic unregister/register during SPA transitions is not required in version 1 of this standard. It SHOULD be introduced only for a demonstrated problem and MUST have tests for route changes, registration, cancellation, and teardown. The concrete representation and runtime behavior are owned by [#16](https://github.com/lugovsky/openwebmcp/issues/16).

## Tool safety

### Reads

A read-only tool MUST NOT intentionally change website or account state and MUST declare the applicable read-only annotation. It MUST NOT report completion until the requested read has completed according to its documented scope. An empty result MAY be a successful read when the page or endpoint genuinely contains no matching data.

### Navigation

A tool that cannot complete on the current page MUST use the navigation outcome defined by the [tool result contract](tool-result-contract.md). Navigation MUST be represented as an incomplete outcome, not as successful completion. A tool MUST NOT claim that a destination action occurred merely because it produced or opened a URL.

### Verified UI mutations

A tool capable of changing website or account state MUST NOT declare itself read-only. Before mutating, it MUST validate the target and relevant page state. After attempting the mutation, it MUST read back or otherwise verify the intended postcondition before reporting completion.

If verification fails, the tool MUST NOT imply that no change occurred. Retrying an ambiguous mutation MUST NOT silently duplicate a potentially completed action. A tool documented as preparing a draft or requiring manual confirmation MUST NOT submit the action for the user.

## Untrusted website content

Text and structured data obtained from a website MUST be treated as untrusted content. A tool that returns website-controlled content MUST declare the applicable untrusted-content annotation. Website content MUST NOT be interpreted as tool instructions, allowed to change tool policy, or copied into diagnostics without the documented bounds and redaction appropriate to that field.

Tool descriptions and results SHOULD distinguish website-provided content from tool-authored guidance. Packages MUST NOT expose credentials, session tokens, cookies, private response headers, or unrelated page content.

## Session, credentials, and origins

When authentication is needed, site tools MUST use the user's current browser session. They MUST NOT require users to create separate API credentials unless a future product-level design explicitly introduces that capability.

Cross-origin access MAY be used only for an explicitly declared and documented official or public endpoint. A package MUST document the endpoint's purpose and credential behavior, and MUST NOT forward browser-session credentials to an undeclared origin. Session-backed internal or site requests MUST follow the origin, redirect, and credential policy owned by [#15](https://github.com/lugovsky/openwebmcp/issues/15).

## Bounded operations and cancellation

Potentially unbounded work MUST have site-appropriate limits. This includes pagination, scrolling, polling, retries, response reads, result collection, concurrency, and in-memory retention when those operations are present. The package README MUST document limits that materially affect tool behavior.

Operations that wait, fetch, scroll, poll, retry, or perform substantial iteration MUST support caller cancellation. A cancelled operation MUST stop further work and MUST NOT be converted into an ordinary success. Concrete primitives, default limits, timeout composition, and error mapping are owned by [#15](https://github.com/lugovsky/openwebmcp/issues/15).

## Compatibility

Existing public tool names and successful result payloads MUST remain compatible during site migrations unless the migration explicitly documents and approves a breaking change. Removing or renaming a field, changing its type, or changing its established meaning is a breaking change. Adding an optional field MAY be compatible when existing callers can ignore it safely.

Internal module layouts, adapters, diagnostics, and failure representations MAY change when public success behavior and safety guarantees are preserved. Result semantics remain subject to the [tool result contract](tool-result-contract.md) and the adapter-result work in [#14](https://github.com/lugovsky/openwebmcp/issues/14).

## Test obligations

Every public tool MUST have deterministic offline coverage through its wrapped WebMCP contract. That coverage MUST verify that the tool registers with its public metadata and returns a valid workflow result for representative success and failure paths.

Additional tests are mandatory when applicable:

- Non-trivial pure parsing, classification, bounding, or domain logic MUST have focused unit tests.
- DOM-dependent reads or page classification MUST have sanitized fixture tests.
- UI mutations MUST have mutation-safety tests covering target validation, postcondition verification, and ambiguous failure behavior.
- Behavior that materially depends on a live website or endpoint MUST have a separately runnable live-smoke test or a documented reason why a safe live check is not possible.

Offline tests MUST NOT require network access, credentials, or private user data. Live-smoke tests MUST NOT run as part of every ordinary local test invocation. Exact directories, runners, fixtures, and reusable contract-harness APIs are owned by [#13](https://github.com/lugovsky/openwebmcp/issues/13).

## Package README

Every site package MUST have a README that documents:

- supported domains and relevant page contexts;
- public tools, page preconditions, returned data, and side effects;
- implementation strategy and site-specific selectors, endpoints, or assumptions likely to change;
- authentication, session, challenge, and cross-origin behavior;
- mutation verification and any manual-confirmation boundary;
- site-specific limits and important operational constraints;
- offline and live test instructions that apply to the package; and
- known compatibility exceptions or limitations.

Benchmark results belong in `BENCHMARKS.md` under the [benchmark policy](benchmarking-site-tools.md), not in this standard.

## Source-of-truth map

| Concern | Normative owner |
| --- | --- |
| Cross-package site invariants and governance | This document |
| Public `WorkflowResult` completion, failure, and navigation semantics | [Tool result contract](tool-result-contract.md) |
| Adapter-level errors, retryability, diagnostics, and conversion to `WorkflowResult` | [#14](https://github.com/lugovsky/openwebmcp/issues/14) until its accepted contract is documented |
| Canonical metadata schema and validation | [#11](https://github.com/lugovsky/openwebmcp/issues/11) until its accepted schema is documented |
| Test layout and contract-harness conventions | [#13](https://github.com/lugovsky/openwebmcp/issues/13) until its accepted harness is documented |
| Shared runtime primitives and operational defaults | [#15](https://github.com/lugovsky/openwebmcp/issues/15) until its accepted runtime contract is documented |
| Lifecycle, extension registration, and page-applicability mechanics | [#16](https://github.com/lugovsky/openwebmcp/issues/16) until its accepted lifecycle contract is documented |
| Benchmark method and validation | [Benchmarking site tools](benchmarking-site-tools.md) and [#18](https://github.com/lugovsky/openwebmcp/issues/18) |
| Site-specific domains, selectors, endpoints, limits, and constraints | The site package README |

Open foundation issues own unresolved design decisions only until their accepted artifacts are documented. The ratification checkpoint in [#9](https://github.com/lugovsky/openwebmcp/issues/9) MUST replace temporary issue ownership with durable documents, schemas, types, or tested code before broad migration.

## Illustrative package tree

The following tree illustrates the responsibility boundaries. It does not prescribe exact metadata, source, or test paths.

```text
packages/sites/<site>/
  package.json
  README.md
  BENCHMARKS.md
  <canonical site metadata>     Format owned by #11
  src/
    index.ts                    Pure package entry point
    tools/                      Thin WebMCP definitions
    adapters/                   Site DOM, UI, and API behavior
    domain/                     Site concepts and types
  test/
    contract/                   Universal offline wrapped coverage
    unit/                       When non-trivial pure logic exists
    fixtures/                   When behavior depends on page markup
    live/                       When a safe live smoke test applies
```

## Pull request checklist

- [ ] The package owns only website-specific behavior; extension and shared-runtime responsibilities remain outside it.
- [ ] Metadata and package entry-point imports have no browser side effects.
- [ ] Canonical site information covers identity, supported secure origins, runtime needs, tool namespace, inventory, and page applicability without duplicating another source of truth.
- [ ] Tool definitions are thin, and site interaction and interpretation remain in independently testable adapters where practical.
- [ ] Every tool documents and validates its page preconditions.
- [ ] Read-only, untrusted-content, and mutation annotations match actual behavior.
- [ ] Navigation is reported as incomplete, and every mutation verifies its postcondition before reporting completion.
- [ ] Draft or manual-confirmation tools cannot submit the action.
- [ ] Website content is bounded and treated as untrusted; credentials and unrelated private content cannot enter results or diagnostics.
- [ ] Cross-origin endpoints and their credential behavior are explicitly declared and documented.
- [ ] Potentially unbounded operations have documented limits and observe caller cancellation when applicable.
- [ ] Public tool names and successful payloads remain compatible, or an approved breaking change is documented.
- [ ] Every public tool has offline wrapped-contract coverage; unit, fixture, mutation-safety, and live-smoke tests are present when applicable.
- [ ] Fixtures and tests contain no credentials or private user data.
- [ ] The package README contains the required site-specific information, and benchmarks follow the separate benchmark policy.
- [ ] No universal DOM abstraction or site semantics were added to shared infrastructure.

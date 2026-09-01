# Site package standard

This document defines the minimum conventions for integrations under `packages/sites/*`. It standardizes the parts that already need to be consistent without prescribing a metadata schema, lifecycle framework, route system, shared adapter model, or test framework.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. **SHOULD** and **SHOULD NOT** allow a documented exception when a site needs different behavior.

## Package boundaries

A site package owns its WebMCP tool definitions, website operations, domain types, selectors, endpoint knowledge, and site-specific interpretation. The extension owns injection and mounting. The common package owns only contracts and helpers whose semantics are genuinely shared.

Site classification, selectors, parsing, challenge detection, limits, UI behavior, and business semantics MUST remain in the site package. A shared abstraction SHOULD be introduced only after at least three implementations demonstrate the same semantics. Shared infrastructure MUST NOT introduce a universal DOM abstraction.

## Recommended structure

```text
packages/sites/<site>/
  package.json
  README.md
  src/
    index.ts
    tools/
    api/          optional
    dom/          optional
    result.ts     optional
  test/
    fixtures/     optional
```

These are responsibility boundaries, not mandatory directory names. A package MAY keep a different layout when its behavior remains clear.

`src/index.ts` SHOULD be a pure assembly point. Tool-definition modules SHOULD be thin: declare the WebMCP-facing metadata and execution entry point, then delegate website interaction and interpretation to focused `api/`, `dom/`, or equivalent modules. Domain types SHOULD remain independent of WebMCP response formatting.

Large files SHOULD be split only when the split improves testing or isolates code that changes for a different reason. File size alone is not a reason to introduce another layer.

## Import behavior

Importing site metadata or a package entry point MUST NOT:

- patch browser globals;
- register tools, listeners, observers, or timers;
- read or mutate the DOM;
- start network work; or
- navigate the page.

Browser effects MUST start only when the extension explicitly mounts the package.

Canonical metadata fields and repository validation are defined by [Site metadata](site-metadata.md).

## Tool behavior and safety

A tool SHOULD document and validate any page preconditions required for safe execution.

A read-only tool MUST NOT intentionally change website or account state and MUST declare the applicable read-only annotation. A tool that cannot complete on the current page MUST use the incomplete navigation outcome defined by the [tool result contract](tool-result-contract.md), rather than reporting success.

A tool capable of changing state MUST NOT declare itself read-only. It MUST validate the target before acting and verify the intended postcondition before reporting completion. If verification fails, the tool MUST NOT imply that no change occurred. A tool described as preparing a draft or requiring manual confirmation MUST NOT submit the action for the user.

Website-provided text and structured data MUST be treated as untrusted. A tool that returns website-controlled content MUST declare the applicable untrusted-content annotation. Website content MUST NOT be interpreted as tool instructions or allowed to change tool policy.

When authentication is needed, tools SHOULD use the user's current browser session instead of requiring separate credentials. Packages MUST NOT expose cookies, tokens, credentials, private response headers, or unrelated page content. Cross-origin endpoints and their credential behavior MUST be documented in the package README.

Pagination, scrolling, polling, retries, and result collection MUST be bounded when present. Limits that materially affect results MUST be documented in the package README.

## Compatibility

Existing public tool names and successful result payloads MUST remain compatible unless a change explicitly documents and approves a breaking change. Internal modules and failure handling MAY change when public success behavior and safety guarantees are preserved.

## Tests

Every package MUST expose a standard `test` script and provide offline tests for the behavior that applies to it. Every new or materially changed tool MUST have a relevant automated test. DOM-dependent behavior SHOULD use sanitized fixtures when practical. Tests for state-changing tools MUST cover target validation, postcondition verification, and failure behavior.

Ordinary tests SHOULD run offline without credentials or private user data. Live smoke tests MAY exist as a separate command when they provide useful coverage, but they MUST NOT run as part of every ordinary local test invocation.

## Package README

Every site package MUST have a README that documents:

- supported domains and relevant page contexts;
- public tools, returned data, and side effects;
- implementation strategy and unstable selectors, endpoints, or assumptions;
- authentication, challenge, and cross-origin behavior;
- important limits and constraints; and
- applicable test commands.

Benchmarking remains a separate process described in [Benchmarking site tools](benchmarking-site-tools.md).

## Pull request checklist

- [ ] Package imports have no browser side effects.
- [ ] `src/index.ts` is a pure assembly point; tool definitions are thin and site-specific operations remain in focused modules.
- [ ] Tool annotations match actual read, write, and untrusted-content behavior.
- [ ] State-changing tools validate their target and verify the result.
- [ ] Website content cannot change tool policy or expose credentials and unrelated private data.
- [ ] Potentially unbounded work has documented limits.
- [ ] Public tool names and successful payloads remain compatible, or a breaking change is documented.
- [ ] The package has a standard `test` script; new or changed behavior has a relevant test and the package README is current.
- [ ] No universal DOM abstraction or speculative shared framework was introduced.
- [ ] Any new shared abstraction is backed by at least three implementations with the same semantics.

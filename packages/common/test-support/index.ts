import assert from "node:assert/strict";
import {
  mountSite,
  type SitePackage,
  type ToolExecutionOptions,
  type WorkflowResult
} from "../src/index";
import { isWorkflowResult } from "../src/result";

type SiteModule = SitePackage | { default: SitePackage };

type RegisteredTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute(input: Record<string, unknown>, options?: ToolExecutionOptions): unknown | Promise<unknown>;
};

type Registration = {
  tool: RegisteredTool;
  options?: { signal?: AbortSignal };
};

export type SiteTestHarness = {
  site: SitePackage;
  registrations: readonly Registration[];
  tool(name: string): RegisteredTool;
  execute<T = unknown>(
    name: string,
    input?: Record<string, unknown>,
    options?: ToolExecutionOptions
  ): Promise<WorkflowResult<T>>;
  dispose(): void;
};

export type SiteTestEnvironment = {
  document?: object;
  window?: object;
  registrationTimeoutMs?: number;
};

function siteFrom(module: SiteModule) {
  return "default" in module ? module.default : module;
}

function restoreGlobal(name: "document" | "window", descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete (globalThis as Record<string, unknown>)[name];
}

function assertNonEmptyString(value: unknown, label: string) {
  assert.equal(typeof value, "string", `${label} must be a string.`);
  assert.ok((value as string).trim(), `${label} must not be empty.`);
}

export function parseToolResult<T = unknown>(value: unknown): WorkflowResult<T> {
  assert.ok(value && typeof value === "object", "Wrapped execution must return an object.");
  const content = (value as { content?: unknown }).content;
  assert.ok(Array.isArray(content), "Wrapped execution must return a content array.");
  assert.equal(content.length, 1, "Wrapped execution must return one content item.");
  assert.equal(content[0]?.type, "text", "Wrapped execution content must be text.");
  assertNonEmptyString(content[0]?.text, "Wrapped execution text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content[0].text);
  } catch (error) {
    assert.fail(`Wrapped execution text must be valid JSON: ${String(error)}`);
  }
  assert.ok(isWorkflowResult(parsed), "Wrapped execution must contain a valid workflow result envelope.");
  return parsed as WorkflowResult<T>;
}

export function assertSiteContract(harness: SiteTestHarness, expectedToolNames: readonly string[]) {
  const actualNames = harness.registrations.map(({ tool }) => tool.name);
  assert.deepEqual(
    [...actualNames].sort(),
    [...expectedToolNames].sort(),
    "The site must register exactly the expected tools."
  );

  for (const expectedName of expectedToolNames) {
    assert.equal(
      actualNames.filter(name => name === expectedName).length,
      1,
      `${expectedName} must register exactly once.`
    );
  }

  for (const { tool } of harness.registrations) {
    assertNonEmptyString(tool.name, "Tool name");
    assertNonEmptyString(tool.title, `${tool.name} title`);
    assertNonEmptyString(tool.description, `${tool.name} description`);
    assert.ok(
      tool.inputSchema && typeof tool.inputSchema === "object" && !Array.isArray(tool.inputSchema),
      `${tool.name} must declare an input schema.`
    );
    assert.ok(
      tool.annotations && typeof tool.annotations === "object" && !Array.isArray(tool.annotations),
      `${tool.name} must declare annotations.`
    );
  }
}

export async function importAndMountSite(
  loadSite: () => SiteModule | Promise<SiteModule>,
  environment: SiteTestEnvironment = {}
): Promise<SiteTestHarness> {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const registrations: Registration[] = [];
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  let disposed = false;

  const defaultWindow = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const registered = listeners.get(type) ?? new Set();
      registered.add(listener);
      listeners.set(type, registered);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(listener);
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  };
  const windowFixture = { ...defaultWindow, ...environment.window };
  const documentFixture = environment.document ?? {};
  const previousModelContext = Object.getOwnPropertyDescriptor(documentFixture, "modelContext");
  Object.defineProperty(documentFixture, "modelContext", {
    configurable: true,
    value: {
      async registerTool(tool: RegisteredTool, options?: { signal?: AbortSignal }) {
        registrations.push({ tool, options });
      }
    }
  });

  Object.defineProperty(globalThis, "window", { configurable: true, value: windowFixture });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentFixture });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const listener of listeners.get("pagehide") ?? []) {
      if (typeof listener === "function") listener(new Event("pagehide"));
      else listener.handleEvent(new Event("pagehide"));
    }
    if (previousModelContext) {
      Object.defineProperty(documentFixture, "modelContext", previousModelContext);
    } else {
      delete (documentFixture as { modelContext?: unknown }).modelContext;
    }
    restoreGlobal("document", previousDocument);
    restoreGlobal("window", previousWindow);
  };

  try {
    const site = siteFrom(await loadSite());
    mountSite(site, environment.registrationTimeoutMs ?? 100);

    const deadline = Date.now() + (environment.registrationTimeoutMs ?? 1_000);
    while (registrations.length < site.tools.length && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert.equal(
      registrations.length,
      site.tools.length,
      `Expected ${site.tools.length} registrations, received ${registrations.length}.`
    );

    const tool = (name: string) => {
      const matches = registrations.filter(registration => registration.tool.name === name);
      assert.equal(matches.length, 1, `Expected exactly one registered tool named ${name}.`);
      return matches[0].tool;
    };

    return {
      site,
      registrations,
      tool,
      async execute<T = unknown>(
        name: string,
        input: Record<string, unknown> = {},
        options?: ToolExecutionOptions
      ) {
        return parseToolResult<T>(await tool(name).execute(input, options));
      },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

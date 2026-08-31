import { wrapTool } from "./tool";
import type { WorkflowResult } from "./result";

export { completed, failed, navigationRequired, ToolError, type WorkflowResult } from "./result";
export { wrapTool } from "./tool";

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type ToolExecutionOptions = { signal: AbortSignal };

export type WebMcpTool<TInput extends object = Record<string, unknown>, TOutput = unknown> = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute(input: TInput, options?: ToolExecutionOptions): WorkflowResult<TOutput> | Promise<WorkflowResult<TOutput>>;
};

export type SiteManifest = {
  id: string;
  title: string;
  matches: string[];
  version: string;
};

export type SitePackage = SiteManifest & {
  tools: WebMcpTool<any>[];
};

type ModelContext = {
  registerTool(tool: ReturnType<typeof wrapTool>, options?: { signal?: AbortSignal }): Promise<void>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export function defineSite(site: SitePackage) {
  return site;
}

export function mountSite(site: SitePackage, timeoutMs = 30_000) {
  const controller = new AbortController();
  window.addEventListener("pagehide", () => controller.abort(), { once: true });

  void registerSiteTools(site, controller, timeoutMs);
}

async function registerSiteTools(site: SitePackage, controller: AbortController, timeoutMs: number) {
  const startedAt = Date.now();
  while (!controller.signal.aborted && Date.now() - startedAt < timeoutMs) {
    if (document.modelContext) break;
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }

  if (!document.modelContext || controller.signal.aborted) {
    if (!controller.signal.aborted) {
      console.info(`WebMCP is unavailable; no ${site.title} tools were registered.`);
    }
    return;
  }

  for (const tool of site.tools) {
    try {
      await document.modelContext.registerTool(wrapTool(tool), { signal: controller.signal });
    } catch (error) {
      console.warn(`Failed to register WebMCP tool ${tool.name}`, error);
    }
  }
}

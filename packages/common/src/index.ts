export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpTool<TInput extends object = Record<string, unknown>> = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute(input: TInput): unknown | Promise<unknown>;
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
  registerTool(tool: WebMcpTool<any>, options?: { signal?: AbortSignal }): Promise<void>;
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
      await document.modelContext.registerTool(tool, { signal: controller.signal });
    } catch (error) {
      console.warn(`Failed to register WebMCP tool ${tool.name}`, error);
    }
  }
}

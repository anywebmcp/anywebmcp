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

export function mountSite(site: SitePackage) {
  if (!document.modelContext) return;

  const controller = new AbortController();

  for (const tool of site.tools) {
    void document.modelContext
      .registerTool(tool, { signal: controller.signal })
      .catch(error => console.warn(`Failed to register WebMCP tool ${tool.name}`, error));
  }

  window.addEventListener("pagehide", () => controller.abort(), { once: true });
}

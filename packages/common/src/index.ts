export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: ToolAnnotations;
  execute(input: object, options: { signal: AbortSignal }): unknown;
};

export type SiteManifest = {
  id: string;
  title: string;
  matches: string[];
  version: string;
};

export type SitePackage = SiteManifest & {
  tools: WebMcpTool[];
};

type ModelContext = {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void>;
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
    void document.modelContext.registerTool(tool, {
      signal: controller.signal
    });
  }

  window.addEventListener("pagehide", () => controller.abort(), { once: true });
}


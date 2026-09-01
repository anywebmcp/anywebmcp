import { readFileSync } from "node:fs";
import path from "node:path";
import { DOMParser } from "linkedom";

export const origin = "https://www.ebay.com";

export function fixture(name: string) {
  return readFileSync(path.join(process.cwd(), "test", "fixtures", name), "utf8");
}

export function fixtureDocument(name: string) {
  return new DOMParser().parseFromString(fixture(name), "text/html") as unknown as Document;
}

export function installDom(documentRoot = fixtureDocument("search.html"), href = `${origin}/sch/i.html?_nkw=thinkpad`) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hostname: "www.ebay.com",
        origin,
        href
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis)
    }
  });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentRoot });
  Object.defineProperty(globalThis, "DOMParser", { configurable: true, value: DOMParser });
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: { escape: (value: unknown) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") }
  });
  return documentRoot;
}

export function htmlResponse(html: string, url: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text() {
      return html;
    }
  } as Response;
}

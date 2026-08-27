import { defineSite, type SiteManifest } from "@openwebmcp/common";

export const manifest: SiteManifest = {
  id: "x",
  title: "X",
  matches: ["https://x.com/*", "https://twitter.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: []
});

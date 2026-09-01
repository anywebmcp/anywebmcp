import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { compareProductsTool } from "./tools/compare-products";
import { readProductTool } from "./tools/read-product";
import { searchProductsTool } from "./tools/search-products";

export const manifest: SiteManifest = {
  id: "temu",
  title: "Temu",
  matches: ["https://www.temu.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [searchProductsTool, readProductTool, compareProductsTool]
});

import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { listCommentsTool } from "./tools/list-comments";
import { listLaunchesTool } from "./tools/list-launches";
import { readProductTool } from "./tools/read-product";
import { searchProductsTool } from "./tools/search-products";

export const manifest: SiteManifest = {
  id: "producthunt",
  title: "Product Hunt",
  matches: ["https://www.producthunt.com/*", "https://producthunt.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [listLaunchesTool, readProductTool, listCommentsTool, searchProductsTool]
});

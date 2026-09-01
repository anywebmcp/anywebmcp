import { defineSite, type SiteManifest } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { listCommentsTool } from "./tools/list-comments";
import { listLaunchesTool } from "./tools/list-launches";
import { readProductTool } from "./tools/read-product";
import { searchProductsTool } from "./tools/search-products";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [listLaunchesTool, readProductTool, listCommentsTool, searchProductsTool]
});

import { defineSite, type SiteManifest } from "@anywebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { getWatchlistTool } from "./tools/get-watchlist";
import { readItemTool } from "./tools/read-item";
import { readItemsTool } from "./tools/read-items";
import { searchItemsTool } from "./tools/search-items";
import { setWatchStateTool } from "./tools/set-watch-state";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [searchItemsTool, readItemTool, readItemsTool, getWatchlistTool, setWatchStateTool]
});

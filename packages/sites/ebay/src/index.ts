import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { getWatchlistTool } from "./tools/get-watchlist";
import { readItemTool } from "./tools/read-item";
import { readItemsTool } from "./tools/read-items";
import { searchItemsTool } from "./tools/search-items";
import { setWatchStateTool } from "./tools/set-watch-state";

export const manifest: SiteManifest = {
  id: "ebay",
  title: "eBay",
  matches: [
    "https://*.ebay.com/*",
    "https://*.ebay.co.uk/*",
    "https://*.ebay.de/*",
    "https://*.ebay.fr/*",
    "https://*.ebay.it/*",
    "https://*.ebay.es/*",
    "https://*.ebay.ca/*",
    "https://*.ebay.com.au/*"
  ],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [searchItemsTool, readItemTool, readItemsTool, getWatchlistTool, setWatchStateTool]
});

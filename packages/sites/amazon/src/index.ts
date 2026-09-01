import { defineSite, type SiteManifest } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { compareProductsTool } from "./tools/compare-products";
import { getBuyingOptionsTool } from "./tools/get-buying-options";
import { getProductTool } from "./tools/get-product";
import { getReviewSummaryTool } from "./tools/get-review-summary";
import { readReviewsTool } from "./tools/read-reviews";
import { searchProductsTool } from "./tools/search-products";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [
    searchProductsTool,
    getProductTool,
    getBuyingOptionsTool,
    readReviewsTool,
    getReviewSummaryTool,
    compareProductsTool
  ]
});

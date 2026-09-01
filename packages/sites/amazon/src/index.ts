import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { compareProductsTool } from "./tools/compare-products";
import { getBuyingOptionsTool } from "./tools/get-buying-options";
import { getProductTool } from "./tools/get-product";
import { getReviewSummaryTool } from "./tools/get-review-summary";
import { readReviewsTool } from "./tools/read-reviews";
import { searchProductsTool } from "./tools/search-products";

export const manifest: SiteManifest = {
  id: "amazon",
  title: "Amazon",
  matches: [
    "https://www.amazon.com/*",
    "https://www.amazon.ca/*",
    "https://www.amazon.com.mx/*",
    "https://www.amazon.com.br/*",
    "https://www.amazon.co.uk/*",
    "https://www.amazon.ie/*",
    "https://www.amazon.de/*",
    "https://www.amazon.fr/*",
    "https://www.amazon.it/*",
    "https://www.amazon.es/*",
    "https://www.amazon.nl/*",
    "https://www.amazon.se/*",
    "https://www.amazon.pl/*",
    "https://www.amazon.com.be/*",
    "https://www.amazon.co.jp/*",
    "https://www.amazon.in/*",
    "https://www.amazon.com.au/*",
    "https://www.amazon.sg/*",
    "https://www.amazon.ae/*",
    "https://www.amazon.sa/*",
    "https://www.amazon.com.tr/*",
    "https://www.amazon.eg/*",
    "https://www.amazon.co.za/*"
  ],
  version: "0.1.0"
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

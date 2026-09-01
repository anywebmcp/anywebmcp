import { defineSite, type SiteManifest } from "@anywebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { collectListingTool } from "./tools/collect-listing";
import { getCommunityRulesTool } from "./tools/get-community-rules";
import { prepareReplyDraftTool } from "./tools/prepare-reply-draft";
import { readThreadTool } from "./tools/read-thread";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [
    collectListingTool,
    readThreadTool,
    getCommunityRulesTool,
    prepareReplyDraftTool
  ]
});

import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { collectListingTool } from "./tools/collect-listing";
import { getCommunityRulesTool } from "./tools/get-community-rules";
import { prepareReplyDraftTool } from "./tools/prepare-reply-draft";
import { readThreadTool } from "./tools/read-thread";

export const manifest: SiteManifest = {
  id: "reddit",
  title: "Reddit",
  matches: ["https://www.reddit.com/*", "https://old.reddit.com/*"],
  version: "0.1.0"
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

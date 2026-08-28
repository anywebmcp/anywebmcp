import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { collectFeedPostsTool } from "./tools/collect-feed-posts";
import { ensurePostTool } from "./tools/ensure-post";
import { listLoadedPostsTool } from "./tools/list-loaded-posts";
import { prepareCommentDraftTool } from "./tools/prepare-comment-draft";
import { readPostTool } from "./tools/read-post";

export const manifest: SiteManifest = {
  id: "linkedin",
  title: "LinkedIn",
  matches: ["https://www.linkedin.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [
    listLoadedPostsTool,
    collectFeedPostsTool,
    readPostTool,
    ensurePostTool,
    prepareCommentDraftTool
  ]
});

import { defineSite, type SiteManifest } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { collectFeedPostsTool } from "./tools/collect-feed-posts";
import { ensurePostTool } from "./tools/ensure-post";
import { listLoadedPostsTool } from "./tools/list-loaded-posts";
import { prepareCommentDraftTool } from "./tools/prepare-comment-draft";
import { readPostTool } from "./tools/read-post";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
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

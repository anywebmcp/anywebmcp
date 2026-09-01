import { defineSite, type SiteManifest } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { createPostTool } from "./tools/create-post";
import { getApiStatusTool } from "./tools/get-api-status";
import { getPostsTool } from "./tools/get-posts";
import { replyToPostTool } from "./tools/reply-to-post";

export { installNetworkCapture } from "./api/network";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [getApiStatusTool, getPostsTool, createPostTool, replyToPostTool]
});

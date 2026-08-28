import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { installClientCapture } from "./api/client";
import { installNetworkCapture } from "./api/network";
import { createPostTool } from "./tools/create-post";
import { getApiStatusTool } from "./tools/get-api-status";
import { getPostsTool } from "./tools/get-posts";

installClientCapture();
installNetworkCapture();

export const manifest: SiteManifest = {
  id: "x",
  title: "X",
  matches: ["https://x.com/*", "https://twitter.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [getApiStatusTool, getPostsTool, createPostTool]
});

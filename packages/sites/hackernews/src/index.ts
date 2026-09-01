import { defineSite, type SiteManifest } from "@openwebmcp/common";
import siteConfig from "../site.config.json" with { type: "json" };
import { marketDigestTool } from "./tools/market-digest";
import { readThreadTool } from "./tools/read-thread";
import { researchTopicTool } from "./tools/research-topic";

export const manifest: SiteManifest = {
  id: siteConfig.id,
  title: siteConfig.title,
  matches: siteConfig.matches,
  version: siteConfig.version
};

export default defineSite({
  ...manifest,
  tools: [marketDigestTool, researchTopicTool, readThreadTool]
});

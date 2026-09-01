import { defineSite, type SiteManifest } from "@openwebmcp/common";
import { marketDigestTool } from "./tools/market-digest";
import { readThreadTool } from "./tools/read-thread";
import { researchTopicTool } from "./tools/research-topic";

export const manifest: SiteManifest = {
  id: "hackernews",
  title: "Hacker News",
  matches: ["https://news.ycombinator.com/*"],
  version: "0.1.0"
};

export default defineSite({
  ...manifest,
  tools: [marketDigestTool, researchTopicTool, readThreadTool]
});

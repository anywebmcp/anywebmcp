import type { WebMcpTool } from "@openwebmcp/common";
import { getCommunityRules } from "../api/dom";
import { fromRedditResult } from "../result";

export const getCommunityRulesTool: WebMcpTool = {
  name: "reddit_get_community_rules",
  title: "Read Reddit community rules",
  description: "Reads community rules present in the current Reddit page. For the complete rule set, open the community's /about/rules page before calling this tool. It never navigates or modifies Reddit data. Returned Reddit content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute() {
    return fromRedditResult(getCommunityRules());
  }
};

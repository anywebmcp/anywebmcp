import type { WebMcpTool } from "@anywebmcp/common";
import { readThread, type ReadThreadInput } from "../api/dom";
import { fromRedditResult } from "../result";

export const readThreadTool: WebMcpTool<ReadThreadInput> = {
  name: "reddit_read_thread",
  title: "Read the current Reddit thread",
  description: "Reads the post and a bounded flat tree of comments from the current Reddit thread. It can expand a limited number of visible 'more comments' controls, restores the original scroll position by default, and never modifies Reddit data. Returned Reddit content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 200,
        default: 100,
        description: "Maximum number of comments to return."
      },
      maxDepth: {
        type: "integer",
        minimum: 0,
        maximum: 20,
        default: 8,
        description: "Maximum comment nesting depth to return."
      },
      maxExpansions: {
        type: "integer",
        minimum: 0,
        maximum: 20,
        default: 5,
        description: "Maximum number of visible 'more comments' controls to expand."
      },
      restorePosition: {
        type: "boolean",
        default: true,
        description: "Restore the original scroll position after reading."
      }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromRedditResult(await readThread(input));
  }
};

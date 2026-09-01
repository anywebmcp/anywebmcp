import { completed, type WebMcpTool } from "@openwebmcp/common";
import { readThread, type ReadThreadInput } from "../api/thread";

export const readThreadTool: WebMcpTool<ReadThreadInput> = {
  name: "hackernews_read_thread",
  title: "Read a Hacker News discussion",
  description: "Reads a bounded Hacker News discussion as structured comments with stable IDs, permalinks, depths, and branch sizes. Can preserve HN order or prioritize the largest top-level branches. Returned Hacker News content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        minimum: 1,
        description: "HN story ID returned by another Hacker News tool or visible in an item URL."
      },
      mode: {
        type: "string",
        enum: ["hn", "top_branches"],
        default: "top_branches",
        description: "Preserve HN branch order or visit the largest top-level discussion branches first."
      },
      maxComments: {
        type: "integer",
        minimum: 1,
        maximum: 500,
        default: 150,
        description: "Maximum comments to return."
      },
      maxDepth: {
        type: "integer",
        minimum: 0,
        maximum: 20,
        default: 8,
        description: "Maximum reply depth, where top-level comments have depth zero."
      }
    },
    required: ["id"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return completed(await readThread(input));
  }
};

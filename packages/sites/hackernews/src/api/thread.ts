import { ToolError } from "@openwebmcp/common";
import { getAlgoliaItem } from "./client";
import { flattenComments } from "./logic";
import { publicStoryFromAlgoliaItem } from "./normalize";

export type ReadThreadInput = {
  id: number;
  mode?: "hn" | "top_branches";
  maxComments?: number;
  maxDepth?: number;
};

export async function readThread({
  id,
  mode = "top_branches",
  maxComments = 150,
  maxDepth = 8
}: ReadThreadInput) {
  const item = await getAlgoliaItem(id);
  if (!item) throw new ToolError(`Hacker News item ${id} was not found.`);
  const story = publicStoryFromAlgoliaItem(item);
  if (!story) throw new ToolError(`Hacker News item ${id} is not a readable story.`);

  const result = flattenComments(item.children ?? [], mode, maxDepth, maxComments);
  return {
    story,
    selection: {
      mode,
      maxComments,
      maxDepth,
      returnedComments: result.comments.length,
      commentsWithinDepth: result.totalWithinDepth,
      truncated: result.truncated
    },
    comments: result.comments
  };
}

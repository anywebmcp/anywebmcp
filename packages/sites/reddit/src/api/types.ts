export const MAX_POST_TEXT = 20_000;
export const MAX_COMMENT_TEXT = 20_000;
export const MAX_DRAFT_TEXT = 10_000;
export const MAX_COLLECTION_LIMIT = 50;
export const MAX_COLLECTION_SCROLLS = 10;
export const MAX_COMMENT_LIMIT = 200;
export const MAX_COMMENT_DEPTH = 20;
export const MAX_COMMENT_EXPANSIONS = 20;
export const MAX_REGISTRY_SIZE = 250;

export type PageType =
  | "blocked"
  | "community_rules"
  | "listing"
  | "search"
  | "submit"
  | "thread"
  | "user_profile"
  | "unknown";

export type PageContext = {
  url: string;
  pageType: PageType;
  subreddit: string | null;
  postId: string | null;
  sort: string | null;
  access: "available" | "human_verification_required" | "network_blocked";
  authentication: "signed_in" | "signed_out" | "unknown";
};

export type RedditPost = {
  postId: string;
  stability: "fullname" | "permalink" | "fingerprint";
  permalink: string | null;
  subreddit: string | null;
  author: string | null;
  title: string;
  body: string;
  postType: string | null;
  createdAt: string | null;
  score: number | null;
  commentCount: number | null;
  nsfw: boolean;
  spoiler: boolean;
  truncated: boolean;
};

export type PostSnapshot = RedditPost & {
  fingerprint: string;
  lastSeenY: number | null;
  lastSeenAt: number;
};

export type LivePost = PostSnapshot & { root: HTMLElement };

export type RedditComment = {
  commentId: string;
  parentId: string | null;
  postId: string | null;
  permalink: string | null;
  author: string | null;
  body: string;
  depth: number;
  score: number | null;
  createdAt: string | null;
  isOp: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  isDeleted: boolean;
};

export type FailureOptions = {
  retryable?: boolean;
  diagnostics?: Record<string, unknown>;
  suggestedAction?: string | null;
};

export type CollectListingInput = {
  limit?: number;
  maxScrolls?: number;
  restorePosition?: boolean;
};

export type ReadThreadInput = {
  limit?: number;
  maxDepth?: number;
  maxExpansions?: number;
  restorePosition?: boolean;
};

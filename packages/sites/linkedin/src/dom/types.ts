export type LivePost = {
  postId: string;
  urn: string | null;
  url: string | null;
  fingerprint: string;
  stability: "canonical" | "fingerprint";
  author: string;
  authorUrl: string | null;
  text: string;
  root: HTMLElement;
};

export type PostSnapshot = Omit<LivePost, "root"> & {
  lastSeenY: number | null;
  lastSeenAt: number;
};

export type PublicPost = Omit<PostSnapshot, "lastSeenY" | "lastSeenAt"> & {
  truncated: boolean;
  mounted: boolean;
};

export type ScrollContainer = HTMLElement | Window;

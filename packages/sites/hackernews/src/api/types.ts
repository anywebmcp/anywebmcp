export type FirebaseItem = {
  id: number;
  deleted?: boolean;
  dead?: boolean;
  type?: "job" | "story" | "comment" | "poll" | "pollopt";
  by?: string;
  time?: number;
  text?: string;
  parent?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  descendants?: number;
};

export type AlgoliaHit = {
  objectID: string;
  created_at?: string;
  created_at_i?: number;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  points?: number | null;
  story_text?: string | null;
  comment_text?: string | null;
  num_comments?: number | null;
  story_id?: number | null;
  story_title?: string | null;
  story_url?: string | null;
  parent_id?: number | null;
  _tags?: string[];
};

export type AlgoliaSearchResponse = {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
};

export type AlgoliaItem = {
  id: number;
  created_at?: string | null;
  created_at_i?: number | null;
  author?: string | null;
  title?: string | null;
  url?: string | null;
  text?: string | null;
  points?: number | null;
  parent_id?: number | null;
  children?: AlgoliaItem[];
};

export type PublicStory = {
  id: number;
  title: string;
  url: string | null;
  hnUrl: string;
  domain: string | null;
  author: string | null;
  createdAt: string | null;
  points: number;
  commentCount: number;
  text: string | null;
};

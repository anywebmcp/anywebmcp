export const launchSearchHit = {
  objectID: "101",
  created_at: "2026-08-31T12:00:00.000Z",
  created_at_i: 1_788_177_600,
  title: "Show HN: A fixture-backed research tool",
  url: "https://example.com/research-tool",
  author: "fixture-author",
  points: 42,
  story_text: null,
  num_comments: 1
};

export const researchStoryHit = {
  objectID: "202",
  created_at: "2026-08-30T12:00:00.000Z",
  created_at_i: 1_788_091_200,
  title: "Ask HN: What do you use for local-first sync?",
  url: null,
  author: "researcher",
  points: 21,
  story_text: "Looking for reliable offline sync.",
  num_comments: 3
};

export const researchCommentHit = {
  objectID: "303",
  created_at: "2026-08-30T13:00:00.000Z",
  created_at_i: 1_788_094_800,
  author: "commenter",
  comment_text: "We use a local-first database for offline sync.",
  story_id: 202,
  story_title: researchStoryHit.title,
  parent_id: 202
};

export const researchFirebaseItem = {
  id: 202,
  type: "story",
  by: "researcher",
  time: 1_788_091_200,
  text: "Looking for reliable offline sync.",
  score: 21,
  title: researchStoryHit.title,
  descendants: 3
};

export const threadItem = {
  id: 101,
  created_at: launchSearchHit.created_at,
  created_at_i: launchSearchHit.created_at_i,
  author: launchSearchHit.author,
  title: launchSearchHit.title,
  url: launchSearchHit.url,
  points: launchSearchHit.points,
  children: [
    {
      id: 102,
      created_at: "2026-08-31T12:30:00.000Z",
      created_at_i: 1_788_179_400,
      author: "reader",
      text: "Useful fixture comment.",
      parent_id: 101,
      children: []
    }
  ]
};

export function searchResponse(hits: object[]) {
  return {
    hits,
    nbHits: hits.length,
    page: 0,
    nbPages: hits.length ? 1 : 0,
    hitsPerPage: 100
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  detectLaunchSignals,
  detectProblemSignals,
  engagementMetrics,
  flattenComments,
  matchingTopics,
  topTerms
} from "../src/api/logic";
import { htmlToText } from "../src/api/normalize";
import type { AlgoliaItem, PublicStory } from "../src/api/types";

const story: PublicStory = {
  id: 1,
  title: "Show HN: A local-first database for AI agents",
  url: "https://example.com",
  hnUrl: "https://news.ycombinator.com/item?id=1",
  domain: "example.com",
  author: "tester",
  createdAt: "2026-01-01T00:00:00.000Z",
  points: 10,
  commentCount: 5,
  text: "Offline sync with CRDTs"
};

test("normalizes the small HTML subset returned by HN APIs", () => {
  assert.equal(
    htmlToText("One &amp; two<p>next<br>line &#x1F680;"),
    "One & two\nnext\nline 🚀"
  );
  assert.equal(htmlToText("invalid &#99999999; entity"), "invalid &#99999999; entity");
});

test("detects launch and problem evidence without classifying arbitrary titles", () => {
  assert.deepEqual(detectLaunchSignals(story.title), ["show_hn"]);
  assert.deepEqual(detectLaunchSignals("We open sourced our sync engine"), ["open_sourced"]);
  assert.deepEqual(detectLaunchSignals("Thoughts about open source databases"), []);
  assert.deepEqual(detectProblemSignals("Ask HN: What do you use for offline sync?"), [
    "ask_hn",
    "seeking_solution"
  ]);
});

test("requires a phrase or every meaningful topic token", () => {
  assert.deepEqual(matchingTopics(story, ["local-first database", "vector database", "AI agents"]), [
    "local-first database",
    "AI agents"
  ]);
});

test("uses a transparent engagement formula", () => {
  assert.deepEqual(engagementMetrics(story, Date.parse("2026-01-01T10:00:00.000Z")), {
    engagementScore: 20,
    ageHours: 10,
    velocityPerHour: 2
  });
});

test("prioritizes the largest top-level branches and reports truncation", () => {
  const comments: AlgoliaItem[] = [
    { id: 10, parent_id: 1, text: "small", children: [] },
    {
      id: 20,
      parent_id: 1,
      text: "large",
      children: [
        { id: 21, parent_id: 20, text: "reply", children: [
          { id: 22, parent_id: 21, text: "nested", children: [] }
        ] }
      ]
    }
  ];
  const result = flattenComments(comments, "top_branches", 10, 2);
  assert.deepEqual(result.comments.map(comment => comment.id), [20, 21]);
  assert.equal(result.totalWithinDepth, 4);
  assert.equal(result.truncated, true);
  assert.equal(result.comments[0].subtreeSize, 2);
});

test("extracts related terms by distinct matched items rather than raw repetition", () => {
  assert.deepEqual(topTerms(["sqlite sqlite sync", "sqlite database"], 2), [
    { term: "sqlite", matchedItems: 2 },
    { term: "database", matchedItems: 1 }
  ]);
});

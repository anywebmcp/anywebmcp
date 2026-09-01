import { getFirebaseItems, searchAlgolia } from "./client";
import {
  detectLaunchSignals,
  detectProblemSignals,
  engagementMetrics,
  topTerms
} from "./logic";
import { htmlToText, isoFromUnix, publicStoryFromFirebase } from "./normalize";
import type { AlgoliaHit } from "./types";

export type ResearchTopicInput = {
  topic: string;
  queries?: string[];
  periodDays?: number;
  maxThreads?: number;
  maxEvidenceComments?: number;
};

type TaggedHit = {
  hit: AlgoliaHit;
  kind: "story" | "comment";
  matchedQueries: Set<string>;
};

function normalizedQueries(topic: string, queries: string[]) {
  const values = [topic, ...queries].map(value => value.trim()).filter(Boolean);
  const seen = new Set<string>();
  return values.filter(value => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function hitTimestamp(hit: AlgoliaHit) {
  return hit.created_at_i ?? (hit.created_at ? Math.floor(Date.parse(hit.created_at) / 1000) : 0);
}

function storyIdForHit(tagged: TaggedHit) {
  if (tagged.kind === "story") return Number(tagged.hit.objectID);
  return tagged.hit.story_id ?? null;
}

export async function researchTopic({
  topic,
  queries = [],
  periodDays = 365,
  maxThreads = 20,
  maxEvidenceComments = 100
}: ResearchTopicInput) {
  const now = Date.now();
  const to = Math.floor(now / 1000) + 1;
  const from = to - periodDays * 86_400;
  const searchQueries = normalizedQueries(topic, queries);

  const searchResults = await Promise.all(searchQueries.flatMap(query => (
    (["story", "comment"] as const).map(async kind => ({
      query,
      kind,
      response: await searchAlgolia({
        query,
        tag: kind,
        from,
        to,
        hitsPerPage: 100,
        sort: "relevance"
      })
    }))
  )));

  const distinctHits = new Map<string, TaggedHit>();
  let retrievedHitsBeforeDeduplication = 0;
  for (const { query, kind, response } of searchResults) {
    retrievedHitsBeforeDeduplication += response.hits.length;
    for (const hit of response.hits) {
      const key = `${kind}:${hit.objectID}`;
      const existing = distinctHits.get(key) ?? {
        hit,
        kind,
        matchedQueries: new Set<string>()
      };
      existing.matchedQueries.add(query);
      distinctHits.set(key, existing);
    }
  }

  const hits = [...distinctHits.values()];
  const storyHits = hits.filter(hit => hit.kind === "story");
  const commentHits = hits.filter(hit => hit.kind === "comment");
  const threadSignals = new Map<number, {
    matchedQueries: Set<string>;
    matchedCommentCount: number;
    storyHit: AlgoliaHit | null;
  }>();

  for (const tagged of hits) {
    const storyId = storyIdForHit(tagged);
    if (!storyId || !Number.isInteger(storyId)) continue;
    const signal = threadSignals.get(storyId) ?? {
      matchedQueries: new Set<string>(),
      matchedCommentCount: 0,
      storyHit: null
    };
    tagged.matchedQueries.forEach(query => signal.matchedQueries.add(query));
    if (tagged.kind === "comment") signal.matchedCommentCount += 1;
    if (tagged.kind === "story") signal.storyHit = tagged.hit;
    threadSignals.set(storyId, signal);
  }

  const candidateThreadIds = [...threadSignals.entries()]
    .sort(([, left], [, right]) => {
      const leftScore = (left.storyHit?.points ?? 0)
        + (left.storyHit?.num_comments ?? 0) * 2
        + left.matchedCommentCount * 5
        + left.matchedQueries.size * 3;
      const rightScore = (right.storyHit?.points ?? 0)
        + (right.storyHit?.num_comments ?? 0) * 2
        + right.matchedCommentCount * 5
        + right.matchedQueries.size * 3;
      return rightScore - leftScore;
    })
    .slice(0, Math.max(maxThreads * 2, maxThreads))
    .map(([id]) => id);

  const firebaseItems = await getFirebaseItems(candidateThreadIds);
  const topThreads = firebaseItems
    .map(item => item ? publicStoryFromFirebase(item) : null)
    .filter(story => story !== null)
    .map(story => {
      const signal = threadSignals.get(story.id)!;
      return {
        ...story,
        matchedQueries: [...signal.matchedQueries],
        matchedCommentCount: signal.matchedCommentCount,
        launchSignals: detectLaunchSignals(story.title),
        problemSignals: detectProblemSignals(story.title),
        metrics: engagementMetrics(story, now)
      };
    })
    .sort((left, right) =>
      right.metrics.engagementScore - left.metrics.engagementScore
      || right.matchedCommentCount - left.matchedCommentCount
    )
    .slice(0, maxThreads);

  const evidenceComments = commentHits
    .sort((left, right) =>
      right.matchedQueries.size - left.matchedQueries.size
      || hitTimestamp(right.hit) - hitTimestamp(left.hit)
    )
    .slice(0, maxEvidenceComments)
    .map(({ hit, matchedQueries }) => ({
      id: Number(hit.objectID),
      storyId: hit.story_id ?? null,
      storyTitle: hit.story_title ? htmlToText(hit.story_title) : null,
      author: hit.author || null,
      createdAt: hit.created_at || isoFromUnix(hit.created_at_i),
      text: htmlToText(hit.comment_text),
      matchedQueries: [...matchedQueries],
      permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`
    }));

  const activity = new Map<string, { stories: number; comments: number }>();
  for (const { hit, kind } of hits) {
    const timestamp = hitTimestamp(hit);
    if (!timestamp) continue;
    const month = new Date(timestamp * 1000).toISOString().slice(0, 7);
    const bucket = activity.get(month) ?? { stories: 0, comments: 0 };
    if (kind === "story") bucket.stories += 1;
    else bucket.comments += 1;
    activity.set(month, bucket);
  }

  const authors = new Set(hits.map(({ hit }) => hit.author).filter(Boolean));
  const terms = topTerms(hits.map(({ hit }) =>
    [hit.title, hit.story_text, hit.comment_text].filter(Boolean).join(" ")
  ));
  const threadsWithRepeatedCommentMatches = [...threadSignals.values()]
    .filter(signal => signal.matchedCommentCount >= 3).length;

  return {
    generatedAt: new Date(now).toISOString(),
    topic,
    period: {
      days: periodDays,
      from: new Date(from * 1000).toISOString(),
      to: new Date(to * 1000).toISOString()
    },
    queries: searchQueries,
    observedSignals: {
      sampledDistinctStories: storyHits.length,
      sampledDistinctComments: commentHits.length,
      sampledUniqueAuthors: authors.size,
      distinctMatchedThreads: threadSignals.size,
      threadsWithAtLeastThreeMatchedComments: threadsWithRepeatedCommentMatches
    },
    sampledMonthlyActivity: [...activity.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, counts]) => ({ month, ...counts })),
    relatedTerms: terms,
    launches: topThreads.filter(thread => thread.launchSignals.length > 0),
    problemDiscussions: topThreads.filter(thread => thread.problemSignals.length > 0),
    topThreads,
    evidenceComments,
    coverage: {
      retrievedHitsBeforeDeduplication,
      sampledDistinctHits: hits.length,
      evidenceCommentsReturned: evidenceComments.length,
      truncated: searchResults.some(({ response }) => response.nbHits > response.hits.length),
      queryStats: searchResults.map(({ query, kind, response }) => ({
        query,
        kind,
        totalHits: response.nbHits,
        retrievedHits: response.hits.length,
        truncated: response.nbHits > response.hits.length
      })),
      interpretation: "totalHits is exact for each query/type pair, but totals must not be added across synonymous queries because the same HN item may match several queries. Monthly activity and unique-author counts describe only the deduplicated retrieved sample."
    },
    caution: "These are Hacker News interest signals, not market-size estimates. The audience and ranking are strongly skewed toward technical early adopters; comments may be negative, ironic, or off-topic and require source-aware interpretation."
  };
}

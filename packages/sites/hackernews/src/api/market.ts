import { getAlgoliaItem, mapWithConcurrency, searchAlgolia } from "./client";
import {
  detectLaunchSignals,
  engagementMetrics,
  flattenComments,
  matchingTopics
} from "./logic";
import { publicStoryFromHit } from "./normalize";
import type { PublicStory } from "./types";

export type MarketDigestInput = {
  periodDays?: number;
  topics?: string[];
  limit?: number;
  minPoints?: number;
  minComments?: number;
  commentPreviewCount?: number;
};

const MARKET_QUERIES = [
  "Show HN",
  "Launch HN",
  "released",
  "launching",
  "introducing",
  "announcing",
  "open sourced"
];

type Candidate = {
  story: PublicStory;
  signals: Set<string>;
  sourceQueries: Set<string>;
};

export async function marketDigest({
  periodDays = 7,
  topics = [],
  limit = 30,
  minPoints = 0,
  minComments = 0,
  commentPreviewCount = 3
}: MarketDigestInput) {
  const now = Date.now();
  const to = Math.floor(now / 1000) + 1;
  const from = to - periodDays * 86_400;
  const searches = await Promise.all(MARKET_QUERIES.map(async query => ({
    query,
    response: await searchAlgolia({
      query,
      tag: "story",
      from,
      to,
      hitsPerPage: 100,
      sort: "date"
    })
  })));

  const candidates = new Map<number, Candidate>();
  for (const { query, response } of searches) {
    for (const hit of response.hits) {
      const story = publicStoryFromHit(hit);
      if (!story) continue;
      const signals = detectLaunchSignals(story.title);
      if (signals.length === 0) continue;

      const existing = candidates.get(story.id) ?? {
        story,
        signals: new Set<string>(),
        sourceQueries: new Set<string>()
      };
      signals.forEach(signal => existing.signals.add(signal));
      existing.sourceQueries.add(query);
      candidates.set(story.id, existing);
    }
  }

  const normalizedTopics = topics.map(topic => topic.trim()).filter(Boolean);
  const ranked = [...candidates.values()]
    .map(candidate => ({
      ...candidate,
      matchedTopics: matchingTopics(candidate.story, normalizedTopics),
      metrics: engagementMetrics(candidate.story, now)
    }))
    .filter(candidate => normalizedTopics.length === 0 || candidate.matchedTopics.length > 0)
    .filter(candidate => candidate.story.points >= minPoints)
    .filter(candidate => candidate.story.commentCount >= minComments)
    .sort((left, right) =>
      (right.metrics.velocityPerHour ?? -1) - (left.metrics.velocityPerHour ?? -1)
      || right.metrics.engagementScore - left.metrics.engagementScore
      || right.story.id - left.story.id
    );

  const selected = ranked.slice(0, limit);
  const threadItems = commentPreviewCount > 0
    ? await mapWithConcurrency(selected, 6, async candidate => {
      try {
        return await getAlgoliaItem(candidate.story.id);
      } catch {
        return null;
      }
    })
    : selected.map(() => null);

  const launches = selected.map((candidate, index) => {
    const thread = threadItems[index];
    const flattened = thread
      ? flattenComments(thread.children ?? [], "top_branches", 12, 500).comments
      : [];
    const commentHighlights = flattened
      .filter(comment => comment.text)
      .sort((left, right) => right.subtreeSize - left.subtreeSize)
      .slice(0, commentPreviewCount)
      .map(comment => ({
        id: comment.id,
        author: comment.author,
        text: comment.text,
        directReplyCount: comment.directReplyCount,
        subtreeSize: comment.subtreeSize,
        permalink: comment.permalink
      }));

    return {
      ...candidate.story,
      launchSignals: [...candidate.signals],
      matchedSearchQueries: [...candidate.sourceQueries],
      matchedTopics: candidate.matchedTopics,
      metrics: candidate.metrics,
      commentHighlights
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    period: {
      days: periodDays,
      from: new Date(from * 1000).toISOString(),
      to: new Date(to * 1000).toISOString()
    },
    filters: {
      topics: normalizedTopics,
      minPoints,
      minComments
    },
    methodology: {
      selection: "Recent HN stories whose titles contain explicit Show HN, Launch HN, release, launch, announcement, or open-sourcing signals.",
      ranking: "engagementScore = points + 2 * comments; velocityPerHour divides that score by age with a two-hour floor.",
      caution: "The result is a launch radar, not a complete census of products or evidence of market demand. Hacker News has a strongly technical audience."
    },
    coverage: {
      candidateLaunches: candidates.size,
      matchingCandidates: ranked.length,
      returned: launches.length,
      searches: searches.map(({ query, response }) => ({
        query,
        totalHits: response.nbHits,
        retrievedHits: response.hits.length,
        truncated: response.nbHits > response.hits.length
      }))
    },
    launches
  };
}

import { htmlToText, isoFromUnix } from "./normalize";
import type { AlgoliaItem, PublicStory } from "./types";

const LAUNCH_PATTERNS: Array<[string, RegExp]> = [
  ["show_hn", /^show\s+hn\s*:/i],
  ["launch_hn", /^launch\s+hn\s*:/i],
  ["released", /\b(?:released?|launch(?:ed|ing)?|shipping|shipped)\b/i],
  ["introduced", /\b(?:introducing|introduced|announcing|announced)\b/i],
  ["open_sourced", /\bopen[- ]sourc(?:ed|ing)\b/i]
];

const PROBLEM_PATTERNS: Array<[string, RegExp]> = [
  ["ask_hn", /^ask\s+hn\s*:/i],
  ["seeking_alternative", /\b(?:alternative to|replacement for|switch(?:ing)? from)\b/i],
  ["seeking_solution", /\b(?:how do you|what do you use|looking for|need a|recommend)\b/i],
  ["problem_report", /\b(?:problem with|struggl(?:e|ing)|pain point|frustrat(?:ed|ing))\b/i]
];

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "been", "being", "between", "could", "does",
  "from", "have", "here", "into", "just", "more", "most", "much", "only", "other",
  "over", "some", "such", "than", "that", "their", "there", "these", "they", "this",
  "through", "using", "very", "want", "what", "when", "where", "which", "while", "with",
  "would", "your", "show", "launch", "hacker", "news"
]);

export function detectLaunchSignals(title: string) {
  return LAUNCH_PATTERNS.filter(([, pattern]) => pattern.test(title)).map(([name]) => name);
}

export function detectProblemSignals(title: string) {
  return PROBLEM_PATTERNS.filter(([, pattern]) => pattern.test(title)).map(([name]) => name);
}

function topicMatchesHaystack(topic: string, haystack: string) {
  const normalizedTopic = topic.toLowerCase().trim();
  if (!normalizedTopic) return false;
  if (haystack.includes(normalizedTopic)) return true;
  const tokens = normalizedTopic.match(/[\p{L}\p{N}+#.-]{2,}/gu) ?? [];
  return tokens.length > 0 && tokens.every(token => haystack.includes(token));
}

export function matchingTopics(story: PublicStory, topics: string[]) {
  const haystack = [story.title, story.text, story.domain].filter(Boolean).join(" ").toLowerCase();
  return topics.filter(topic => topicMatchesHaystack(topic, haystack));
}

export function engagementMetrics(story: PublicStory, now = Date.now()) {
  const engagementScore = story.points + story.commentCount * 2;
  const createdAt = story.createdAt ? Date.parse(story.createdAt) : Number.NaN;
  const ageHours = Number.isFinite(createdAt) ? Math.max(1, (now - createdAt) / 3_600_000) : null;
  const velocityPerHour = ageHours === null ? null : engagementScore / Math.max(ageHours, 2);
  return {
    engagementScore,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(1)),
    velocityPerHour: velocityPerHour === null ? null : Number(velocityPerHour.toFixed(2))
  };
}

export type PublicComment = {
  id: number;
  parentId: number | null;
  author: string | null;
  createdAt: string | null;
  text: string;
  depth: number;
  directReplyCount: number;
  subtreeSize: number;
  permalink: string;
};

function subtreeSize(item: AlgoliaItem): number {
  return (item.children ?? []).reduce((total, child) => total + 1 + subtreeSize(child), 0);
}

function flattenBranch(
  item: AlgoliaItem,
  depth: number,
  maxDepth: number,
  output: PublicComment[]
) {
  if (depth > maxDepth) return;
  output.push({
    id: item.id,
    parentId: item.parent_id ?? null,
    author: item.author || null,
    createdAt: item.created_at || isoFromUnix(item.created_at_i),
    text: htmlToText(item.text),
    depth,
    directReplyCount: item.children?.length ?? 0,
    subtreeSize: subtreeSize(item),
    permalink: `https://news.ycombinator.com/item?id=${item.id}`
  });
  for (const child of item.children ?? []) {
    flattenBranch(child, depth + 1, maxDepth, output);
  }
}

export function flattenComments(
  comments: AlgoliaItem[],
  mode: "hn" | "top_branches",
  maxDepth: number,
  maxComments: number
) {
  const branches = [...comments];
  if (mode === "top_branches") {
    branches.sort((left, right) => subtreeSize(right) - subtreeSize(left));
  }

  const all: PublicComment[] = [];
  for (const branch of branches) flattenBranch(branch, 0, maxDepth, all);
  return {
    comments: all.slice(0, maxComments),
    totalWithinDepth: all.length,
    truncated: all.length > maxComments
  };
}

export function topTerms(values: string[], limit = 15) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const unique = new Set(
      htmlToText(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]{2,}/gu) ?? []
    );
    for (const token of unique) {
      if (STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([term, matchedItems]) => ({ term, matchedItems }));
}

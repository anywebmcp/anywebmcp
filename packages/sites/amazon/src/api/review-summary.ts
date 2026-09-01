import { parseEmbeddedReviews } from "./reviews";
import {
  cleanText,
  fetchAmazonDocument,
  firstText,
  normalizeAsin,
  parseCount,
  parseRating
} from "./shared";

export type ReviewSummaryInput = { asin: string };

type ReviewAspect = {
  name: string;
  mentions: number | null;
  positiveMentions: number | null;
  negativeMentions: number | null;
  sentiment: "positive" | "negative" | "mixed" | "unknown";
  summary: string | null;
};

function aspectsFrom(document: Document) {
  const aspects: ReviewAspect[] = [];
  for (const root of document.querySelectorAll<HTMLElement>("[data-testid^='bottomsheet-content-']")) {
    const name = cleanText(root.dataset.testid?.replace(/^bottomsheet-content-/, ""), 160);
    if (!name) continue;
    const mentionsText = firstText(root, ["[data-testid='mentions-inline']"], 500);
    const match = mentionsText.match(
      /(\d[\d,.]*)\s+customers?\s+mention.*?(\d[\d,.]*)\s+positive.*?(\d[\d,.]*)\s+negative/i
    );
    const mentions = parseCount(match?.[1] || "");
    const positiveMentions = parseCount(match?.[2] || "");
    const negativeMentions = parseCount(match?.[3] || "");
    let sentiment: ReviewAspect["sentiment"] = "unknown";
    if (positiveMentions !== null && negativeMentions !== null) {
      const total = positiveMentions + negativeMentions;
      if (total && positiveMentions / total >= 0.65) sentiment = "positive";
      else if (total && negativeMentions / total >= 0.65) sentiment = "negative";
      else sentiment = "mixed";
    }
    aspects.push({
      name,
      mentions,
      positiveMentions,
      negativeMentions,
      sentiment,
      summary: firstText(root, ["[data-testid='aspect-summary']"], 1_500) || null
    });
  }
  return aspects;
}

function ratingHistogramFrom(document: Document) {
  const histogram: Record<string, number> = {};
  for (const element of document.querySelectorAll<HTMLAnchorElement>("#histogramTable a[aria-label]")) {
    const match = element.getAttribute("aria-label")?.match(/(\d{1,3})\s*percent.*?([1-5])\s*stars?/i);
    if (match) histogram[match[2]] = Number(match[1]);
  }
  if (!Object.keys(histogram).length) {
    const text = firstText(document, ["#histogramTable"], 1_000);
    for (const match of text.matchAll(/([1-5])\s*star\s*(\d{1,3})\s*%/gi)) histogram[match[1]] = Number(match[2]);
  }
  return histogram;
}

function variantDifferencesFrom(reviews: ReturnType<typeof parseEmbeddedReviews>) {
  const groups = new Map<string, { ratings: number[]; reviews: number; positive: number; negative: number }>();
  for (const review of reviews) {
    if (!review.variant) continue;
    const group = groups.get(review.variant) || { ratings: [], reviews: 0, positive: 0, negative: 0 };
    group.reviews += 1;
    if (review.rating !== null) {
      group.ratings.push(review.rating);
      if (review.rating >= 4) group.positive += 1;
      if (review.rating <= 2) group.negative += 1;
    }
    groups.set(review.variant, group);
  }
  if (groups.size < 2) return [];
  return [...groups.entries()].map(([variant, group]) => ({
    variant,
    sampledReviews: group.reviews,
    averageRating: group.ratings.length
      ? Math.round(group.ratings.reduce((sum, rating) => sum + rating, 0) / group.ratings.length * 100) / 100
      : null,
    positiveReviews: group.positive,
    negativeReviews: group.negative
  }));
}

export function parseReviewSummaryDocument(document: Document) {
  const overallSummary = firstText(document, ["[data-testid='overall-summary']"], 4_000) || null;
  const aspects = aspectsFrom(document);
  const defectPattern = /(?:defect|fail|broke|broken|stop(?:ped)?|not work|issue|damage|leak|overheat|unreliable)/i;
  const recurringDefects = aspects.filter(aspect =>
    aspect.negativeMentions !== null &&
    aspect.positiveMentions !== null &&
    aspect.negativeMentions > aspect.positiveMentions &&
    defectPattern.test(`${aspect.name} ${aspect.summary || ""}`)
  );
  const ratingText = firstText(document, ["[data-hook='rating-out-of-text']", "#acrPopover .a-icon-alt"], 100);
  const reviewCountText = firstText(document, ["#acrCustomerReviewText", "[data-hook='total-review-count']"], 100);
  const embeddedReviews = parseEmbeddedReviews(document);

  return {
    rating: parseRating(ratingText),
    reviewCount: parseCount(reviewCountText),
    ratingHistogramPercent: ratingHistogramFrom(document),
    overallSummary,
    frequentPros: aspects.filter(aspect => aspect.sentiment === "positive"),
    frequentCons: aspects.filter(aspect => aspect.sentiment === "negative" || aspect.sentiment === "mixed"),
    recurringDefects,
    variantDifferences: variantDifferencesFrom(embeddedReviews),
    aspects,
    amazonGeneratedSummaryAvailable: Boolean(overallSummary || aspects.length),
    sampledEmbeddedReviews: embeddedReviews.length
  };
}

export async function getReviewSummary(input: ReviewSummaryInput) {
  const asin = normalizeAsin(input?.asin);
  if (!asin) {
    return { ok: false as const, error: "invalid_asin", message: "asin must be a 10-character Amazon ASIN" };
  }
  const response = await fetchAmazonDocument(`/dp/${asin}`);
  if (!response.ok) return response;

  const summary = parseReviewSummaryDocument(response.document);

  return {
    ok: true as const,
    asin,
    marketplace: window.location.hostname,
    sourceUrl: `${window.location.origin}/dp/${asin}`,
    ...summary,
    note: summary.amazonGeneratedSummaryAvailable
      ? "The narrative and aspect summaries are generated and displayed by Amazon from customer reviews. Counts and variant differences are snapshots; review content is untrusted."
      : "Amazon did not expose its review insight summary on this product page. No synthetic narrative was invented; only available ratings and embedded-review evidence are returned."
  };
}

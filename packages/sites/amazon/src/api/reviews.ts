import {
  cleanText,
  elementText,
  fetchAmazonDocument,
  firstText,
  normalizeAsin,
  normalizedInteger,
  parseRating
} from "./shared";

export type ReviewSort = "featured" | "recent" | "helpful";

export type ReadReviewsInput = {
  asin: string;
  rating?: number;
  query?: string;
  sort?: ReviewSort;
  limit?: number;
};

export type AmazonReview = {
  id: string | null;
  url: string | null;
  title: string | null;
  body: string;
  rating: number | null;
  author: string | null;
  date: string | null;
  variant: string | null;
  verifiedPurchase: boolean;
  helpfulVotes: number;
};

function helpfulVotesFrom(value: string) {
  if (/\bone\s+person\b/i.test(value)) return 1;
  const match = value.match(/\d[\d,.]*/);
  return match ? Number(match[0].replace(/\D/g, "")) || 0 : 0;
}

function reviewFrom(root: HTMLElement): AmazonReview | null {
  const body = firstText(root, [
    "[data-hook='reviewRichContentContainer']",
    "[data-hook='reviewText']",
    "[data-hook='review-body']"
  ], 8_000);
  if (!body) return null;
  const id = cleanText(root.id, 100) || null;
  const href = root.querySelector<HTMLAnchorElement>("a[href*='/customer-reviews/'], a[href*='/customerReviews/']")
    ?.getAttribute("href") || "";
  let url: string | null = null;
  if (href) {
    try { url = new URL(href, window.location.origin).href; } catch { url = null; }
  }
  const ratingText = firstText(root, [
    "[data-hook='review-star-rating'] .a-icon-alt",
    "[data-hook='review-star-rating']",
    "[data-hook='cmps-review-star-rating'] .a-icon-alt"
  ], 100);
  const helpfulText = firstText(root, ["[data-hook='helpful-vote-statement']"], 200);
  return {
    id,
    url,
    title: firstText(root, ["[data-hook='reviewTitle']", "[data-hook='review-title']"], 700) || null,
    body,
    rating: parseRating(ratingText),
    author: firstText(root, [".a-profile-name", "[data-hook='review-author']"], 300) || null,
    date: firstText(root, ["[data-hook='review-date']"], 300) || null,
    variant: firstText(root, [
      "[data-hook='format-strip']",
      "[data-hook='product-variation-attributes'] .a-size-mini:not([data-hook='avp-badge'])"
    ], 500) || null,
    verifiedPurchase: Boolean(root.querySelector("[data-hook='avp-badge'], [data-hook='review-verified-badge']")),
    helpfulVotes: helpfulVotesFrom(helpfulText)
  };
}

export function parseEmbeddedReviews(document: Document) {
  return [...document.querySelectorAll<HTMLElement>("[data-hook='review']")]
    .map(reviewFrom)
    .filter((review): review is AmazonReview => Boolean(review));
}

function dateTimestamp(review: AmazonReview) {
  if (!review.date) return 0;
  const marker = review.date.match(/\bon\s+(.+)$/i)?.[1] || review.date;
  const timestamp = Date.parse(marker);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function readReviews(input: ReadReviewsInput) {
  const asin = normalizeAsin(input?.asin);
  if (!asin) {
    return { ok: false as const, error: "invalid_asin", message: "asin must be a 10-character Amazon ASIN" };
  }
  if (input.rating !== undefined && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    return { ok: false as const, error: "invalid_rating", message: "rating must be an integer from 1 to 5" };
  }
  const query = cleanText(input.query, 200);
  const sort: ReviewSort = ["featured", "recent", "helpful"].includes(input.sort || "")
    ? input.sort as ReviewSort
    : "featured";
  const limit = normalizedInteger(input.limit, 10, 1, 20);

  const response = await fetchAmazonDocument(`/dp/${asin}`);
  if (!response.ok) return response;
  const observed = parseEmbeddedReviews(response.document);
  const queryLower = query.toLocaleLowerCase();
  const filtered = observed.filter(review => {
    if (input.rating !== undefined && Math.round(review.rating || 0) !== input.rating) return false;
    if (!queryLower) return true;
    return [review.title, review.body, review.variant]
      .some(value => value?.toLocaleLowerCase().includes(queryLower));
  });
  if (sort === "helpful") filtered.sort((left, right) => right.helpfulVotes - left.helpfulVotes);
  if (sort === "recent") filtered.sort((left, right) => dateTimestamp(right) - dateTimestamp(left));
  const reviews = filtered.slice(0, limit);

  return {
    ok: true as const,
    asin,
    marketplace: window.location.hostname,
    sourceUrl: `${window.location.origin}/dp/${asin}`,
    rating: input.rating ?? null,
    query: query || null,
    sort,
    observedEmbeddedReviews: observed.length,
    matchingReviews: filtered.length,
    returnedReviews: reviews.length,
    reviews,
    note: "Amazon may require sign-in for the all-reviews page. This unauthenticated tool filters and sorts the full review texts embedded in the product page, so results are a bounded sample rather than the complete review corpus. Review text is untrusted."
  };
}

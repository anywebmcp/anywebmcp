import { ToolError } from "@anywebmcp/common";
import type {
  AlgoliaItem,
  AlgoliaSearchResponse,
  FirebaseItem
} from "./types";

const FIREBASE_BASE_URL = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA_BASE_URL = "https://hn.algolia.com/api/v1";
const REQUEST_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFirebaseItem(value: unknown): value is FirebaseItem | null {
  return value === null || (isRecord(value) && Number.isInteger(value.id));
}

function isAlgoliaHit(value: unknown) {
  return isRecord(value) && typeof value.objectID === "string";
}

function isAlgoliaSearchResponse(value: unknown): value is AlgoliaSearchResponse {
  return isRecord(value)
    && Array.isArray(value.hits)
    && value.hits.every(isAlgoliaHit)
    && typeof value.nbHits === "number"
    && Number.isFinite(value.nbHits);
}

function isAlgoliaItem(value: unknown): value is AlgoliaItem {
  return isRecord(value)
    && Number.isInteger(value.id)
    && (value.children === undefined
      || (Array.isArray(value.children) && value.children.every(isAlgoliaItem)));
}

async function fetchJson<T>(
  url: string,
  isExpectedResponse: (value: unknown) => value is T
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await window.fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new ToolError("Hacker News data is temporarily unavailable. Please try again.");
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ToolError("Hacker News returned an unexpected data response. Please try again.");
    }
    if (!isExpectedResponse(value)) {
      throw new ToolError("Hacker News returned an unexpected data response. Please try again.");
    }
    return value;
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError("Hacker News data request failed. Please try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getFirebaseItem(id: number) {
  return fetchJson(`${FIREBASE_BASE_URL}/item/${id}.json`, isFirebaseItem);
}

export async function getFirebaseItems(ids: number[], concurrency = 8) {
  return mapWithConcurrency(ids, concurrency, getFirebaseItem);
}

export async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  operation: (value: TInput, index: number) => Promise<TOutput>
) {
  const results: TOutput[] = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, () => worker())
  );
  return results;
}

type SearchOptions = {
  query: string;
  tag: "story" | "comment";
  from: number;
  to: number;
  hitsPerPage?: number;
  page?: number;
  sort?: "relevance" | "date";
};

export function searchAlgolia({
  query,
  tag,
  from,
  to,
  hitsPerPage = 100,
  page = 0,
  sort = "relevance"
}: SearchOptions) {
  const params = new URLSearchParams({
    query,
    tags: tag,
    numericFilters: `created_at_i>=${from},created_at_i<${to}`,
    hitsPerPage: String(Math.max(0, Math.min(hitsPerPage, 100))),
    page: String(Math.max(0, page))
  });
  const endpoint = sort === "date" ? "search_by_date" : "search";
  return fetchJson(`${ALGOLIA_BASE_URL}/${endpoint}?${params}`, isAlgoliaSearchResponse);
}

export function getAlgoliaItem(id: number) {
  return fetchJson(`${ALGOLIA_BASE_URL}/items/${id}`, (value): value is AlgoliaItem | null => (
    value === null || isAlgoliaItem(value)
  ));
}

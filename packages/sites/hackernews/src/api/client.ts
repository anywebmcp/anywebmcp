import type {
  AlgoliaItem,
  AlgoliaSearchResponse,
  FirebaseItem
} from "./types";

const FIREBASE_BASE_URL = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA_BASE_URL = "https://hn.algolia.com/api/v1";
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Hacker News data request failed for ${url}: ${message}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getFirebaseItem(id: number) {
  return fetchJson<FirebaseItem | null>(`${FIREBASE_BASE_URL}/item/${id}.json`);
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
  return fetchJson<AlgoliaSearchResponse>(`${ALGOLIA_BASE_URL}/${endpoint}?${params}`);
}

export function getAlgoliaItem(id: number) {
  return fetchJson<AlgoliaItem>(`${ALGOLIA_BASE_URL}/items/${id}`);
}

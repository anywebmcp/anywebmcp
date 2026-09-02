import { ToolError } from "@anywebmcp/common";
import type { HackerNewsOperation } from "../transport/protocol";
import { getHackerNewsTransport, HackerNewsTransportError } from "../transport/state";
import type {
  AlgoliaItem,
  AlgoliaSearchResponse,
  FirebaseItem
} from "./types";

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
  operation: HackerNewsOperation,
  isExpectedResponse: (value: unknown) => value is T
): Promise<T> {
  try {
    const value = await getHackerNewsTransport().request(operation);
    if (!isExpectedResponse(value)) {
      throw new ToolError("Hacker News returned an unexpected data response. Please try again.");
    }
    return value;
  } catch (error) {
    if (error instanceof ToolError) throw error;
    if (error instanceof HackerNewsTransportError) {
      if (error.code === "http") {
        throw new ToolError("Hacker News data is temporarily unavailable. Please try again.");
      }
      if (error.code === "malformed_response") {
        throw new ToolError("Hacker News returned an unexpected data response. Please try again.");
      }
      if (error.code === "transport_unavailable") {
        throw new ToolError(
          "Hacker News extension transport is unavailable. Reload the Hacker News page with the AnyWeb MCP extension enabled."
        );
      }
    }
    throw new ToolError("Hacker News data request failed. Please try again.");
  }
}

export async function getFirebaseItem(id: number) {
  return fetchJson({ operation: "firebaseItem", parameters: { id } }, isFirebaseItem);
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
  return fetchJson({
    operation: "algoliaSearch",
    parameters: {
      query,
      tag,
      from,
      to,
      hitsPerPage: Math.max(0, Math.min(hitsPerPage, 100)),
      page: Math.max(0, page),
      sort
    }
  }, isAlgoliaSearchResponse);
}

export function getAlgoliaItem(id: number) {
  return fetchJson({ operation: "algoliaItem", parameters: { id } }, (value): value is AlgoliaItem | null => (
    value === null || isAlgoliaItem(value)
  ));
}

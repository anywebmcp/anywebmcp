import { clampInteger, cleanText } from "./shared";

export type SearchProductsInput = {
  query: string;
  page?: number;
  limit?: number;
};

type SearchProductNode = {
  id?: string;
  name?: string;
  tagline?: string;
  slug?: string;
  reviewsRating?: number;
  reviewsCount?: number;
  logoUuid?: string;
  isNoLongerOnline?: boolean;
};

type ProductSearchConnection = {
  edges?: Array<{ node?: SearchProductNode }>;
  pageInfo?: {
    page?: number;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
  };
  pagesCount?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findProductSearch(value: unknown, depth = 0): ProductSearchConnection | null {
  if (depth > 12 || !isRecord(value)) return null;
  const connection = value.productSearch;
  if (isRecord(connection) && Array.isArray(connection.edges)) {
    return connection as ProductSearchConnection;
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findProductSearch(item, depth + 1);
        if (found) return found;
      }
      continue;
    }
    const found = findProductSearch(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function hydrationPayload(document: Document) {
  const script = Array.from(document.querySelectorAll("script")).find(candidate => {
    return candidate.textContent?.includes('"productSearch"');
  });
  const source = script?.textContent ?? "";
  const start = source.indexOf(".push(");
  const objectStart = source.indexOf("{", start);
  const objectEnd = source.lastIndexOf("})");
  if (start < 0 || objectStart < 0 || objectEnd < objectStart) return null;
  return JSON.parse(source.slice(objectStart, objectEnd + 1)) as unknown;
}

function logoUrl(uuid: string) {
  if (!uuid) return "";
  return `https://ph-files.imgix.net/${encodeURIComponent(uuid)}?auto=compress,format&fit=crop&h=96&w=96`;
}

export async function searchProducts(input: SearchProductsInput) {
  const query = cleanText(input.query, 100);
  if (!query) {
    return { ok: false, query, count: 0, products: [], error: "Search query cannot be empty." };
  }

  const page = clampInteger(input.page, 1, 1, 1_000);
  const limit = clampInteger(input.limit, 10, 1, 10);
  const url = new URL("/search", location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html" },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        query,
        page,
        count: 0,
        products: [],
        error: `Product Hunt search returned HTTP ${response.status}.`
      };
    }

    const html = await response.text();
    if (html.length > 2_000_000) {
      return { ok: false, query, page, count: 0, products: [], error: "Product Hunt search response was unexpectedly large." };
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const payload = hydrationPayload(parsed);
    const connection = payload === null ? null : findProductSearch(payload);
    if (!connection) {
      return {
        ok: false,
        query,
        page,
        count: 0,
        products: [],
        error: "Product Hunt search data was not found in the returned page."
      };
    }

    const products = (connection.edges ?? [])
      .map(edge => edge.node)
      .filter((node): node is SearchProductNode => Boolean(node?.id && node.name && node.slug))
      .slice(0, limit)
      .map(node => ({
        id: node.id ?? "",
        name: cleanText(node.name, 200),
        slug: node.slug ?? "",
        url: new URL(`/products/${node.slug}`, location.origin).href,
        tagline: cleanText(node.tagline, 300),
        reviewsRating: typeof node.reviewsRating === "number" ? node.reviewsRating : null,
        reviewsCount: typeof node.reviewsCount === "number" ? node.reviewsCount : null,
        imageUrl: logoUrl(node.logoUuid ?? ""),
        isNoLongerOnline: Boolean(node.isNoLongerOnline)
      }));

    return {
      ok: true,
      query,
      page: connection.pageInfo?.page ?? page,
      limit,
      count: products.length,
      pagesCount: connection.pagesCount ?? null,
      hasPreviousPage: Boolean(connection.pageInfo?.hasPreviousPage),
      hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
      searchUrl: url.href,
      products
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, query, page, count: 0, products: [], error: `Product Hunt search failed: ${message}` };
  } finally {
    window.clearTimeout(timeout);
  }
}

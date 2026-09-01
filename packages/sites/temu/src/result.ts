import { completed, failed, navigationRequired } from "@anywebmcp/common";

type TemuFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    suggestedAction?: string;
    diagnostics?: Record<string, unknown>;
  };
};

export function fromTemuResult<T extends { ok: true }>(result: T | TemuFailure) {
  if (!result.ok) {
    const { code, message, suggestedAction, diagnostics } = result.error;
    const url = diagnostics?.url;
    if (code === "NO_SERVER_RENDERED_RESULTS" && typeof url === "string") {
      return navigationRequired(
        url,
        "Open the Temu search-results page, wait for product cards to render, then call temu_search_products again without query."
      );
    }
    if (code === "PRODUCT_PAGE_NOT_READABLE" && typeof url === "string") {
      return navigationRequired(
        url,
        "Open this Temu product page, wait for its title and price to render, then call temu_read_product again with the same product URL or productId."
      );
    }
    return failed([
      `${code}: ${message}`,
      suggestedAction,
      typeof url === "string" ? `Temu URL: ${url}` : null
    ].filter(Boolean).join(" "));
  }
  const { ok, ...data } = result;
  return completed(data);
}

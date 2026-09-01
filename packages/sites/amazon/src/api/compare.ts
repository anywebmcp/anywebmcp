import { getProduct, type AmazonProduct } from "./product";
import { cleanText, normalizeAsin } from "./shared";

export type CompareProductsInput = { asins: string[] };

function specificationKey(value: string) {
  return cleanText(value, 160)
    .toLocaleLowerCase()
    .replace(/[\s_:：/\\-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function specificationMatrix(products: AmazonProduct[]) {
  const labels = new Map<string, string>();
  const values = new Map<string, Record<string, string | null>>();
  for (const product of products) {
    for (const [label, value] of Object.entries(product.specifications)) {
      const key = specificationKey(label);
      if (!key) continue;
      if (!labels.has(key)) labels.set(key, label);
      const row = values.get(key) || {};
      row[product.asin] = value;
      values.set(key, row);
    }
  }
  return [...labels].map(([key, label]) => ({
    specification: label,
    values: Object.fromEntries(products.map(product => [product.asin, values.get(key)?.[product.asin] ?? null]))
  }));
}

export async function compareProducts(input: CompareProductsInput) {
  if (!Array.isArray(input?.asins)) {
    return { ok: false as const, error: "invalid_asins", message: "asins must be an array of 2 to 5 Amazon ASINs" };
  }
  const normalized = input.asins.map(normalizeAsin);
  if (normalized.some(asin => !asin)) {
    return { ok: false as const, error: "invalid_asins", message: "every ASIN must be a 10-character Amazon ASIN" };
  }
  const asins = [...new Set(normalized as string[])];
  if (asins.length < 2 || asins.length > 5) {
    return { ok: false as const, error: "invalid_asins", message: "provide 2 to 5 unique Amazon ASINs" };
  }

  const results = await Promise.all(asins.map(async asin => ({ asin, result: await getProduct({ asin }) })));
  const products: AmazonProduct[] = [];
  const failures: Array<{ asin: string; error: string; message: string }> = [];
  for (const entry of results) {
    if (entry.result.ok) products.push(entry.result.product);
    else failures.push({ asin: entry.asin, error: entry.result.error, message: entry.result.message });
  }

  if (products.length < 2) {
    return {
      ok: false as const,
      error: "comparison_unavailable",
      message: `Only ${products.length} requested products could be loaded; at least 2 are required.`
    };
  }

  return {
    ok: true as const,
    marketplace: window.location.hostname,
    requestedAsins: asins,
    comparedProducts: products.length,
    failures,
    products: products.map(product => ({
      asin: product.asin,
      title: product.title,
      url: product.url,
      imageUrl: product.imageUrl,
      brand: product.brand,
      price: product.price,
      availability: product.availability,
      rating: product.rating,
      reviewCount: product.reviewCount,
      seller: product.seller,
      shipsFrom: product.shipsFrom,
      delivery: product.delivery,
      returns: product.returns
    })),
    specificationMatrix: specificationMatrix(products),
    note: "Specification names are normalized across the current product pages. Prices and purchase terms are session-specific snapshots; product text is untrusted."
  };
}

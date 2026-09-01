import { cleanText } from "../api/parsing";
import type { ProductDetail, ProductSource, ProductSummary } from "../api/types";
import { allProducts } from "./products";
import { structuredVariants } from "./structured-data";
import { deliveryText, elementText } from "./text";

function selectedAttributes(doc: Document) {
  const result: Record<string, string> = {};
  const roots = [...doc.querySelectorAll<HTMLElement>(
    "main [aria-pressed='true'], main [aria-selected='true'], main input:checked"
  )].slice(0, 30);
  for (const element of roots) {
    const value = cleanText(
      element.getAttribute("aria-label") ||
      (element as HTMLInputElement).value ||
      element.closest("label")?.innerText ||
      element.innerText,
      200
    );
    if (!value) continue;
    const group = cleanText(
      element.closest("fieldset")?.querySelector("legend")?.textContent ||
      element.parentElement?.previousElementSibling?.textContent,
      100
    ) || `option${Object.keys(result).length + 1}`;
    result[group] = value;
  }
  return result;
}

export function detailFromDocument(
  doc: Document,
  reference: ProductSummary,
  source: ProductSource
): ProductDetail {
  const products = allProducts(doc, source);
  const matched = products.find(product => product.productId === reference.productId) || products[0] || reference;
  const heading = elementText(doc, ["main h1", "h1", "[data-testid*='title']"], 1_000);
  const description = elementText(doc, [
    "[data-testid*='description']",
    "[class*='description']",
    "[itemprop='description']"
  ], 5_000);
  const seller = doc.querySelector<HTMLAnchorElement>(
    "a[href*='seller'], a[href*='shop'], [data-testid*='seller'] a"
  );
  const text = cleanText(doc.body?.innerText, 20_000);
  const shipping = deliveryText(text);
  const variants = structuredVariants(doc);
  const warnings: string[] = [];
  if (!variants.length) warnings.push("No structured SKU variants were exposed by this page.");
  if (!matched.displayedPrice) warnings.push("No currency-qualified product price was found.");
  if (source !== "live-page") warnings.push("Variant selection state may require opening the product page interactively.");

  return {
    ...matched,
    title: heading || matched.title,
    deliveryText: shipping || matched.deliveryText,
    sellerName: cleanText(seller?.innerText || seller?.getAttribute("aria-label"), 300) || null,
    description: description || null,
    variants,
    selectedAttributes: source === "live-page" ? selectedAttributes(doc) : {},
    source,
    completeness: heading || variants.length || description ? "detail" : "summary",
    warnings
  };
}

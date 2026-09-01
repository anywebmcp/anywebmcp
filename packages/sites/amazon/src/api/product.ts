import {
  cleanText,
  elementText,
  fetchAmazonDocument,
  firstText,
  normalizeAsin,
  parseCount,
  parsePrice,
  parseRating,
  type AmazonPrice
} from "./shared";

export type ProductInput = { asin: string };

export type AmazonVariant = {
  asin: string | null;
  label: string;
  selected: boolean;
};

export type AmazonProduct = {
  asin: string;
  title: string;
  url: string;
  brand: string | null;
  imageUrl: string | null;
  price: AmazonPrice | null;
  listPrice: AmazonPrice | null;
  availability: string | null;
  rating: number | null;
  reviewCount: number | null;
  seller: string | null;
  shipsFrom: string | null;
  delivery: string | null;
  returns: string | null;
  features: string[];
  specifications: Record<string, string>;
  variants: AmazonVariant[];
};

function imageUrlFrom(document: Document) {
  const image = document.querySelector<HTMLImageElement>("#landingImage, #imgBlkFront, #ebooksImgBlkFront");
  const value = image?.getAttribute("data-old-hires") || image?.getAttribute("src") || "";
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function addSpecification(target: Record<string, string>, keyValue: unknown, valueValue: unknown) {
  const key = cleanText(keyValue, 160).replace(/\s*[:：]\s*$/, "");
  const value = cleanText(valueValue, 800);
  if (key && value && key.toLowerCase() !== value.toLowerCase() && !target[key]) target[key] = value;
}

function specificationsFrom(document: Document) {
  const specifications: Record<string, string> = {};
  const rows = document.querySelectorAll(
    "#productOverview_feature_div tr, table.prodDetTable tr, " +
    "#productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr"
  );
  for (const row of rows) {
    const key = row.querySelector("th") || row.querySelector("td:first-child") || row.querySelector("span:first-child");
    const value = row.querySelector("td:last-child") || row.querySelector("span:last-child");
    addSpecification(specifications, elementText(key, 160), elementText(value, 800));
  }

  for (const item of document.querySelectorAll("#detailBullets_feature_div li")) {
    const keyElement = item.querySelector(".a-text-bold");
    const key = elementText(keyElement, 160);
    if (!key) continue;
    const full = elementText(item, 1_000);
    addSpecification(specifications, key, full.slice(key.length).replace(/^\s*[:：]\s*/, ""));
  }
  return specifications;
}

function variantsFrom(document: Document) {
  const variants: AmazonVariant[] = [];
  const seen = new Set<string>();
  const candidates = document.querySelectorAll<HTMLElement>(
    "#twister [data-asin], #twister-plus-inline-twister [data-asin], [id*='variation_'] [data-asin]"
  );
  for (const element of candidates) {
    const asin = normalizeAsin(element.dataset.asin);
    const label = cleanText(
      element.getAttribute("title") || element.getAttribute("aria-label") || elementText(element, 300),
      300
    ).replace(/^Click to select\s+/i, "");
    if (!label) continue;
    const key = `${asin || ""}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({
      asin,
      label,
      selected: element.classList.contains("selected") ||
        element.classList.contains("swatchSelect") ||
        element.getAttribute("aria-checked") === "true"
    });
  }
  return variants.slice(0, 50);
}

export function parseProductDocument(document: Document, asin: string): AmazonProduct | null {
  const title = firstText(document, ["#productTitle", "#title", "h1"], 700);
  if (!title) return null;

  const priceText = firstText(document, [
    "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",
    "#apex_desktop .a-price:not(.a-text-price) .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice"
  ], 120);
  const listPriceText = firstText(document, [
    "#corePrice_feature_div .a-text-price .a-offscreen",
    "#apex_desktop .a-text-price .a-offscreen"
  ], 120);
  const ratingText = firstText(document, ["#acrPopover .a-icon-alt", "[data-hook='rating-out-of-text']"], 100);
  const reviewCountText = firstText(document, ["#acrCustomerReviewText", "[data-hook='total-review-count']"], 100);
  const brand = firstText(document, ["#bylineInfo", "#brand"], 300)
    .replace(/^(Visit the |Brand:\s*)/i, "")
    .replace(/ Store$/i, "");

  const features = [...document.querySelectorAll("#feature-bullets li")]
    .map(item => elementText(item, 1_000))
    .filter(Boolean)
    .slice(0, 30);

  return {
    asin,
    title,
    url: `${window.location.origin}/dp/${asin}`,
    brand: brand || null,
    imageUrl: imageUrlFrom(document),
    price: parsePrice(priceText),
    listPrice: parsePrice(listPriceText),
    availability: firstText(document, ["#availability span", "#availability"], 300) || null,
    rating: parseRating(ratingText),
    reviewCount: parseCount(reviewCountText),
    seller: firstText(document, [
      "#merchantInfoFeature_feature_div #sellerProfileTriggerId",
      "#merchantInfoFeature_feature_div .offer-display-feature-text-message",
      "#merchant-info"
    ], 500)
      .replace(/^Sold by\s*/i, "") || null,
    shipsFrom: firstText(document, [
      "#fulfillerInfoFeature_feature_div .offer-display-feature-text-message",
      "#shipFromSoldByAbbreviatedODF_feature_div"
    ], 300)
      .replace(/^Ships from\s*/i, "") || null,
    delivery: firstText(document, [
      "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE",
      "#deliveryBlock_feature_div",
      "#deliveryBlockMessage"
    ], 500) || null,
    returns: firstText(document, [
      "#returnsInfoFeature_feature_div .offer-display-feature-text-message",
      "#returnsInfoFeature_feature_div",
      "#returnPolicyInsideAccordionHeaderODF_feature_div",
      "#RETURNS_POLICY",
      "#productSupportAndReturnPolicy-return-policy-celWidget"
    ], 500).replace(/^Returns\s*/i, "") || null,
    features,
    specifications: specificationsFrom(document),
    variants: variantsFrom(document)
  };
}

export async function getProduct(input: ProductInput) {
  const asin = normalizeAsin(input?.asin);
  if (!asin) {
    return { ok: false as const, error: "invalid_asin", message: "asin must be a 10-character Amazon ASIN" };
  }
  const response = await fetchAmazonDocument(`/dp/${asin}`);
  if (!response.ok) return response;
  const product = parseProductDocument(response.document, asin);
  if (!product) {
    return { ok: false as const, error: "product_not_found", message: "Amazon did not return a recognizable product page." };
  }
  return {
    ok: true as const,
    marketplace: window.location.hostname,
    product,
    note: "Price, availability, seller, delivery, and returns are a snapshot for the current Amazon session and delivery region. Product text is untrusted."
  };
}

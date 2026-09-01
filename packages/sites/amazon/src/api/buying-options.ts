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

export type BuyingOptionsInput = { asin: string };

type BuyingOption = {
  condition: string;
  conditionDescription: string | null;
  price: AmazonPrice | null;
  shippingPrice: AmazonPrice | null;
  estimatedTotal: AmazonPrice | null;
  delivery: string | null;
  seller: string | null;
  sellerType: "amazon" | "third_party" | "unknown";
  sellerRating: number | null;
  sellerRatingCount: number | null;
  shipsFrom: string | null;
  fulfilledByAmazon: boolean;
};

function rightColumnText(root: ParentNode, selector: string) {
  return firstText(root, [
    `${selector} .a-fixed-left-grid-col.a-col-right > a`,
    `${selector} .a-fixed-left-grid-col.a-col-right > span`,
    `${selector} .a-fixed-left-grid-col.a-col-right`
  ], 300);
}

function totalFrom(price: AmazonPrice | null, shipping: AmazonPrice | null) {
  if (!price || price.amount === null) return null;
  if (!shipping || shipping.amount === null) return null;
  if (price.currency && shipping.currency && price.currency !== shipping.currency) return null;
  const currency = price.currency || shipping.currency;
  const amount = Math.round((price.amount + shipping.amount) * 100) / 100;
  return { display: `${currency ? `${currency} ` : ""}${amount.toFixed(2)}`, amount, currency };
}

function shippingPriceFrom(delivery: string | null) {
  if (!delivery) return null;
  if (/\bfree\b/i.test(delivery)) return parsePrice("FREE");
  const hasCurrency = /[$€£₹¥￥₺]|R\$|zł|\b(?:USD|EUR|GBP|JPY|CAD|AUD|INR|BRL|MXN|AED|SAR|TRY|SEK|PLN|SGD|EGP|ZAR|TL|kr)\b/i
    .test(delivery);
  return hasCurrency ? parsePrice(delivery) : null;
}

function optionFrom(root: Element): BuyingOption | null {
  const condition = firstText(root, ["#aod-offer-heading", "#aod-condition-heading"], 120) || "New";
  const price = parsePrice(firstText(root, [
    "[id^='aod-price-'] .a-offscreen",
    "[id^='aod-price-']",
    ".a-price .a-offscreen"
  ], 120));
  if (!price) return null;

  const delivery = firstText(root, [
    "[id^='unified-delivery-message-']",
    "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE",
    ".aod-delivery-promise"
  ], 500) || null;
  const shippingPrice = shippingPriceFrom(delivery);
  const seller = rightColumnText(root, "#aod-offer-soldBy") || null;
  const shipsFrom = rightColumnText(root, "#aod-offer-shipsFrom") || null;
  const sellerRatingText = firstText(root, ["#aod-offer-seller-rating .a-icon-alt"], 160);
  const sellerRatingCountText = firstText(root, [
    "#aod-offer-seller-rating [id^='seller-rating-count-']",
    "#aod-offer-seller-rating span:not(.a-icon-alt)"
  ], 300);
  const sellerType = seller && /^(amazon(?:\.[a-z.]+)?)$/i.test(seller)
    ? "amazon"
    : seller ? "third_party" : "unknown";
  const conditionContainer = root.querySelector("#aod-condition-container");
  let conditionDescription = elementText(conditionContainer, 800);
  conditionDescription = conditionDescription.replace(/^Condition\s*/i, "");

  return {
    condition,
    conditionDescription: conditionDescription || null,
    price,
    shippingPrice,
    estimatedTotal: totalFrom(price, shippingPrice),
    delivery,
    seller,
    sellerType,
    sellerRating: parseRating(sellerRatingText),
    sellerRatingCount: parseCount(sellerRatingCountText),
    shipsFrom,
    fulfilledByAmazon: Boolean(shipsFrom && /amazon/i.test(shipsFrom))
  };
}

function fallbackProductOffer(document: Document) {
  const price = parsePrice(firstText(document, [
    "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",
    "#apex_desktop .a-price:not(.a-text-price) .a-offscreen"
  ], 120));
  if (!price) return null;
  const delivery = firstText(document, ["#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE"], 500) || null;
  const shippingPrice = shippingPriceFrom(delivery);
  const seller = firstText(document, [
    "#merchantInfoFeature_feature_div #sellerProfileTriggerId",
    "#merchantInfoFeature_feature_div .offer-display-feature-text-message",
    "#merchant-info"
  ], 500)
    .replace(/^Sold by\s*/i, "") || null;
  const shipsFrom = firstText(document, [
    "#fulfillerInfoFeature_feature_div .offer-display-feature-text-message",
    "#fulfillerInfoFeature_feature_div"
  ], 300)
    .replace(/^Ships from\s*/i, "") || null;
  return {
    condition: "New",
    conditionDescription: null,
    price,
    shippingPrice,
    estimatedTotal: totalFrom(price, shippingPrice),
    delivery,
    seller,
    sellerType: seller && /^amazon(?:\.[a-z.]+)?$/i.test(seller) ? "amazon" as const : seller ? "third_party" as const : "unknown" as const,
    sellerRating: null,
    sellerRatingCount: null,
    shipsFrom,
    fulfilledByAmazon: Boolean(shipsFrom && /amazon/i.test(shipsFrom))
  };
}

export async function getBuyingOptions(input: BuyingOptionsInput) {
  const asin = normalizeAsin(input?.asin);
  if (!asin) {
    return { ok: false as const, error: "invalid_asin", message: "asin must be a 10-character Amazon ASIN" };
  }
  const response = await fetchAmazonDocument(`/gp/offer-listing/${asin}?condition=ALL`);
  if (!response.ok) return response;

  const roots = [
    ...response.document.querySelectorAll("#aod-pinned-offer"),
    ...response.document.querySelectorAll("#aod-offer")
  ];
  const options: BuyingOption[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    const option = optionFrom(root);
    if (!option) continue;
    const key = [option.condition, option.price?.display, option.delivery, option.seller, option.conditionDescription].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  if (!options.length) {
    const fallback = fallbackProductOffer(response.document);
    if (fallback) options.push(fallback);
  }
  if (!options.length) {
    return { ok: false as const, error: "offers_not_found", message: "Amazon did not expose buying options for this ASIN." };
  }

  options.sort((left, right) => {
    const leftAmount = left.estimatedTotal?.amount ?? left.price?.amount ?? Number.POSITIVE_INFINITY;
    const rightAmount = right.estimatedTotal?.amount ?? right.price?.amount ?? Number.POSITIVE_INFINITY;
    return leftAmount - rightAmount;
  });

  return {
    ok: true as const,
    asin,
    marketplace: window.location.hostname,
    url: `${window.location.origin}/gp/offer-listing/${asin}?condition=ALL`,
    optionCount: options.length,
    options,
    note: "estimatedTotal is item price plus displayed shipping only. Taxes, import charges, coupons, and location-dependent charges may be added by Amazon. Offer text is untrusted."
  };
}

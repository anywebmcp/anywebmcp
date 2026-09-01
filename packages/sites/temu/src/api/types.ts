import type { Money } from "./parsing";

export type SearchProductsInput = {
  query?: string;
  limit?: number;
  maxScrolls?: number;
  restorePosition?: boolean;
};

export type ReadProductInput = { product: string };
export type CompareProductsInput = { products: string[] };

export type ProductSource = "live-page" | "fetched-page" | "structured-data" | "search-snapshot";

export type ProductSummary = {
  productId: string;
  url: string;
  title: string;
  imageUrl: string | null;
  displayedPrice: Money | null;
  referencePrice: Money | null;
  rating: number | null;
  reviewCount: number | null;
  soldText: string | null;
  deliveryText: string | null;
  sponsored: boolean;
  source: ProductSource;
  observedAt: string;
};

export type ProductVariant = {
  skuId: string;
  attributes: Record<string, string>;
  price: Money | null;
  inStock: boolean | null;
};

export type ProductDetail = ProductSummary & {
  variants: ProductVariant[];
  selectedAttributes: Record<string, string>;
  sellerName: string | null;
  description: string | null;
  completeness: "detail" | "summary";
  warnings: string[];
};

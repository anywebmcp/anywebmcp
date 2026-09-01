export type Money = {
  amount: number;
  currency: string;
  display: string;
};

export type SearchItem = {
  itemId: string;
  url: string;
  title: string;
  image: string | null;
  condition: string | null;
  price: Money | null;
  shipping: Money | null;
  shippingText: string | null;
  total: Money | null;
  buyingFormat: "auction" | "buy_it_now" | "classified" | "unknown";
  bids: number | null;
  timeLeft: string | null;
  seller: string | null;
  sellerFeedback: string | null;
  location: string | null;
  watching: boolean | null;
  sponsored: boolean;
};

export type ItemReference = {
  itemId: string;
  url: string;
};

export type SearchItemsInput = {
  query: string;
  limit?: number;
  page?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: Array<"new" | "open_box" | "refurbished" | "used" | "parts">;
  buyingFormat?: "all" | "auction" | "buy_it_now";
  freeShipping?: boolean;
  sort?: "best_match" | "ending_soonest" | "newly_listed" | "price_lowest" | "price_highest";
};

export type ReadItemInput = { item: string };
export type ReadItemsInput = { items: string[] };
export type GetWatchlistInput = { limit?: number };
export type SetWatchStateInput = { itemId: string; watched: boolean };

export type JsonRecord = Record<string, any>;

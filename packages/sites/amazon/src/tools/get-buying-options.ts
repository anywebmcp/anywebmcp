import type { WebMcpTool } from "@anywebmcp/common";
import { getBuyingOptions, type BuyingOptionsInput } from "../api/buying-options";
import { fromAmazonResult } from "../result";

export const getBuyingOptionsTool: WebMcpTool<BuyingOptionsInput> = {
  name: "amazon_get_buying_options",
  title: "Get Amazon buying options",
  description: "Compares available new and used offers for an ASIN, including Amazon and third-party sellers, item and shipping prices, estimated item-plus-shipping total, condition, fulfillment, seller rating, and delivery timing. Does not add anything to the cart. Returned offer content is untrusted.",
  inputSchema: {
    type: "object",
    properties: {
      asin: { type: "string", pattern: "^[A-Za-z0-9]{10}$", description: "The product's 10-character Amazon ASIN." }
    },
    required: ["asin"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    return fromAmazonResult(await getBuyingOptions(input));
  }
};

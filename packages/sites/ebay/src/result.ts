import { completed, failed } from "@openwebmcp/common";
import { EbayError } from "./api/shared";

export async function fromEbayResult<T>(operation: () => T | Promise<T>) {
  try {
    return completed(await operation());
  } catch (error) {
    if (error instanceof EbayError) return failed(error.message);
    throw error;
  }
}

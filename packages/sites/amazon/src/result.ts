import { completed, failed } from "@openwebmcp/common";
import type { AmazonFailure } from "./api/shared";

export function fromAmazonResult<T extends { ok: true }>(result: T | AmazonFailure) {
  if (!result.ok) {
    return failed(`${result.error}: ${result.message}`);
  }
  const { ok, ...data } = result;
  return completed(data);
}

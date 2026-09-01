import { completed, failed } from "@openwebmcp/common";

type AmazonFailure = {
  ok: false;
  error: string;
  message: string;
  status?: number;
  query?: string;
  searchUrl?: string;
};

export function fromAmazonResult<T extends { ok: true }>(result: T | AmazonFailure) {
  if (!result.ok) {
    return failed(`${result.error}: ${result.message}`);
  }
  const { ok, ...data } = result;
  return completed(data);
}

import { completed, failed } from "@openwebmcp/common";

type ProductHuntResult = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

export function fromProductHuntResult<T extends ProductHuntResult>(result: T) {
  if (result.ok === false || (typeof result.error === "string" && result.error)) {
    return failed(result.error || "Product Hunt request failed.");
  }

  if (result.ok === true) {
    const { ok: _ok, ...data } = result;
    return completed(data);
  }

  return completed(result);
}

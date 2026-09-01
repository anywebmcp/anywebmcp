import { completed, failed } from "@anywebmcp/common";

const MALFORMED_RESULT_MESSAGE = "Product Hunt returned a malformed result.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function fromProductHuntResult(result: unknown) {
  if (!isRecord(result) || (result.ok !== true && result.ok !== false)) {
    return failed(MALFORMED_RESULT_MESSAGE);
  }

  if (result.ok === false) {
    return typeof result.error === "string" && result.error.trim()
      ? failed(result.error)
      : failed(MALFORMED_RESULT_MESSAGE);
  }

  if (Object.hasOwn(result, "error")) return failed(MALFORMED_RESULT_MESSAGE);

  const { ok: _ok, ...data } = result;
  return completed(data);
}

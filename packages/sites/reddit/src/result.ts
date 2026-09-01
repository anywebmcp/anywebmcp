import { completed, failed } from "@anywebmcp/common";

type RedditFailure = {
  ok: false;
  pageContext: unknown;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    diagnostics: Record<string, unknown>;
    suggestedAction?: string;
  };
};

export function fromRedditResult<T extends { ok: true }>(result: T | RedditFailure) {
  if (!result.ok) {
    const { code, message, retryable, diagnostics, suggestedAction } = result.error;
    return failed([
      `${code}: ${message}`,
      suggestedAction,
      `Retryable: ${retryable}.`,
      `Page context: ${JSON.stringify(result.pageContext)}.`,
      Object.keys(diagnostics).length ? `Diagnostics: ${JSON.stringify(diagnostics)}.` : null
    ].filter(Boolean).join(" "));
  }
  const { ok, ...data } = result;
  return completed(data);
}

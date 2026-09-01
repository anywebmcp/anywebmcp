import { completed, failed } from "@anywebmcp/common";

type LinkedInFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    suggestedAction?: string;
    diagnostics?: Record<string, unknown>;
  };
};

export function fromLinkedInResult<T extends { ok: true }>(result: T | LinkedInFailure) {
  if (!result.ok) {
    const { code, message, suggestedAction, diagnostics } = result.error;
    const url = diagnostics?.url;
    return failed([
      `${code}: ${message}`,
      suggestedAction,
      typeof url === "string" ? `Post URL: ${url}` : null
    ].filter(Boolean).join(" "));
  }
  const { ok, ...data } = result;
  return completed(data);
}

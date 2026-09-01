import { cleanText } from "../dom/text";

type FailureOptions = {
  retryable?: boolean;
  postId?: string | null;
  diagnostics?: Record<string, unknown>;
  suggestedAction?: string | null;
};

export function failure(code: string, message: string, {
  retryable = false,
  postId = null,
  diagnostics = {},
  suggestedAction = null
}: FailureOptions = {}) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      retryable,
      ...(postId ? { postId } : {}),
      diagnostics,
      ...(suggestedAction ? { suggestedAction } : {})
    }
  };
}

export function unexpectedFailure(error: unknown, postId: string | null = null) {
  const value = error as { name?: string; message?: string };
  return failure("UNEXPECTED_ERROR", "The LinkedIn page operation failed unexpectedly.", {
    retryable: true,
    postId,
    diagnostics: {
      name: value?.name || "Error",
      detail: cleanText(value?.message || String(error), 500)
    },
    suggestedAction: "Retry once. If it still fails, reload the LinkedIn tab."
  });
}

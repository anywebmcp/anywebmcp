import { cleanText } from "./parsing";

type FailureOptions = {
  retryable?: boolean;
  diagnostics?: Record<string, unknown>;
  suggestedAction?: string;
};

export function failure(code: string, message: string, {
  retryable = false,
  diagnostics = {},
  suggestedAction
}: FailureOptions = {}) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      retryable,
      diagnostics,
      ...(suggestedAction ? { suggestedAction } : {})
    }
  };
}

export function unexpectedFailure(error: unknown) {
  const value = error as { name?: string; message?: string };
  return failure("UNEXPECTED_ERROR", "The Temu page operation failed unexpectedly.", {
    retryable: true,
    diagnostics: {
      name: cleanText(value?.name || "Error", 100),
      detail: cleanText(value?.message || String(error), 500)
    }
  });
}

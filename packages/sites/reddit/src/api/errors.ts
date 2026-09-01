import { compactText } from "./dom-helpers";
import { pageContext } from "./page-context";
import type { FailureOptions } from "./types";

export function failure(code: string, message: string, {
  retryable = false,
  diagnostics = {},
  suggestedAction = null
}: FailureOptions = {}) {
  return {
    ok: false as const,
    pageContext: pageContext(),
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
  return failure("UNEXPECTED_ERROR", "The Reddit page operation failed unexpectedly.", {
    retryable: true,
    diagnostics: {
      name: value?.name || "Error",
      detail: compactText(value?.message || String(error), 500)
    },
    suggestedAction: "Retry once. If it still fails, reload the Reddit tab."
  });
}

export function accessFailure() {
  const context = pageContext();
  if (context.access === "human_verification_required") {
    return failure("HUMAN_VERIFICATION_REQUIRED", "Reddit requires a human verification challenge before page tools can read content.", {
      retryable: true,
      suggestedAction: "Complete Reddit's challenge in the browser, then retry."
    });
  }
  if (context.access === "network_blocked") {
    return failure("NETWORK_BLOCKED", "Reddit blocked this browser session at the network security layer.", {
      retryable: false,
      suggestedAction: "Resolve the block with Reddit or use an approved Reddit access method."
    });
  }
  return null;
}

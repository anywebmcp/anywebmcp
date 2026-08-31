export type WorkflowResult<T> =
  | { status: "completed"; data: T }
  | {
      status: "navigation_required";
      url: string;
      continuationToken?: string;
      instruction: string;
    }
  | { status: "failed"; message: string };

export function completed<T>(data: T) {
  return { status: "completed" as const, data };
}

export function failed(message: string) {
  return { status: "failed" as const, message };
}

export function navigationRequired(url: string, instruction: string, continuationToken?: string) {
  return {
    status: "navigation_required" as const,
    url,
    instruction,
    ...(continuationToken === undefined ? {} : { continuationToken })
  };
}

// Use only for messages intended for the caller; other exceptions stay private.
export class ToolError extends Error {}

export function isWorkflowResult(value: unknown): value is WorkflowResult<unknown> {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  switch (result.status) {
    case "completed":
      return Object.hasOwn(result, "data") && result.data !== undefined;
    case "failed":
      return typeof result.message === "string";
    case "navigation_required":
      return typeof result.url === "string" && typeof result.instruction === "string" &&
        (result.continuationToken === undefined || typeof result.continuationToken === "string");
    default:
      return false;
  }
}

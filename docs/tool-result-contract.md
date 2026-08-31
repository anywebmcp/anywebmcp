# Tool result contract

Follow this contract when creating tools. The common package enforces the result type and wraps tool execution at registration. Navigation continuation storage and the caller's resume flow still need implementation.

## Result payload

Return an explicit outcome from the tool, with data on completion:

```ts
type WorkflowResult<T> =
  | { status: "completed"; data: T }
  | {
      status: "navigation_required";
      url: string;
      continuationToken?: string;
      instruction: string;
    }
  | { status: "failed"; message: string };
```

Return this payload from `execute()`. The common wrapper serializes the result and checks the status and required fields before returning WebMCP text content. It returns `failed` for malformed results, serialization errors, and unexpected exceptions. It forwards execution options and preserves caller cancellation. The wrapper does not navigate or retry actions.

Execution options and their `signal` are both optional: native callers may supply an empty options object. Only check or subscribe to cancellation when a signal is present.

- `completed`: Verify the requested outcome before returning its data. A successful read may return an empty collection.
- `navigation_required`: The operation needs another page before it can finish. Return the destination and the next invocation instructions. Treat this as an intermediate outcome.
- `failed`: Describe why the operation could not complete. A failure after a write attempt does not prove that the write had no effect; verify before retrying.

The wrapper appends result and navigation guidance to tool descriptions. Add any tool-specific instructions yourself. These statuses are a project convention.

## Writing handlers

Import `completed`, `failed`, and `navigationRequired` from `@openwebmcp/common`. Keep the tool's existing metadata and input schema; return outcomes from its handler:

```ts
execute() {
  const posts = getVisiblePosts();
  return completed({ count: posts.length, posts });
}
```

Use `failed(message)` for expected failures. Lower-level helpers can use `throw new ToolError(message)` for messages intended for the caller; the wrapper hides other exception messages. Return JSON-serializable data and use `null` for a successful operation with no data. Do not call `textResult()` or wrap tools yourself.

For navigation, return `navigationRequired(url, instruction, continuationToken?)`. Creating this result does not save state or navigate.

For tools that only prepare an intent URL for manual submission, the navigation instruction hands off to the user instead of requesting another tool call. The user reviews and submits the draft in the website. Reinvoking such a tool only returns the URL again; it never confirms or publishes the draft.

## Navigation and continuation

Keep steps within one `execute()` call when the document survives, including supported SPA route changes. For a full page load:

1. Return `navigation_required` before navigating. In `instruction`, name the tool and arguments the caller should use after navigation.
2. The caller navigates to `url`, waits for the destination's tools to register, and invokes the indicated tool.
3. The destination handler checks the page and inputs, performs the operation, and returns its outcome.

For a repeatable read, the caller can resend the original arguments. For an operation that needs saved state, persist it outside the page before returning a `continuationToken`. Declare the token in the tool's input schema. Bind the saved operation to its tab, destination, inputs, and expiry; reject expired or mismatched continuations. Do not rely on page variables or service-worker memory for persistence.

Preserve approval for the exact target and input when resuming writes, and prevent duplicate submissions on retries. A navigation signal alone does not confirm completion. Add continuation support to a tool only after implementing both state handling and the caller's resume flow.

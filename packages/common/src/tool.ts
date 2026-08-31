import type { ToolExecutionOptions, WebMcpTool } from "./index";
import { failed, isWorkflowResult, ToolError, type WorkflowResult } from "./result";

const RESULT_DESCRIPTION = 'Returns status "completed" with data, "failed" with message, or "navigation_required" with url, instruction, and optional continuationToken. For navigation_required, navigate to url and follow instruction to resume; the operation is not complete.';

function textResult(value: WorkflowResult<unknown>) {
  let text = JSON.stringify(value, null, 2);
  if (!text || !isWorkflowResult(JSON.parse(text))) {
    text = JSON.stringify(failed("Tool returned an invalid result."), null, 2);
  }
  return { content: [{ type: "text" as const, text }] };
}

export function wrapTool<TInput extends object, TOutput>(tool: WebMcpTool<TInput, TOutput>) {
  return {
    ...tool,
    description: `${tool.description} ${RESULT_DESCRIPTION}`,
    async execute(input: TInput, options?: ToolExecutionOptions) {
      const signal = options?.signal;
      try {
        signal?.throwIfAborted();
        const result = await tool.execute(input, options);
        signal?.throwIfAborted();
        return textResult(result);
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        return textResult(failed(error instanceof ToolError
          ? error.message
          : "Tool execution failed. Verify the outcome before retrying an action that could change data."));
      }
    }
  };
}

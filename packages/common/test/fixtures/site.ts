import {
  completed,
  defineSite,
  navigationRequired,
  type ToolExecutionOptions,
  type WebMcpTool
} from "../../src/index";

export let readExecutions = 0;

const readTool: WebMcpTool<{ value?: string }> = {
  name: "fixture_read",
  title: "Read fixture data",
  description: "Returns deterministic fixture data without changing state.",
  inputSchema: {
    type: "object",
    properties: { value: { type: "string" } },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute({ value = "fixture" }, options?: ToolExecutionOptions) {
    readExecutions += 1;
    return completed({ value, optionsProvided: options !== undefined });
  }
};

const prepareTool: WebMcpTool<{ value: string }> = {
  name: "fixture_prepare",
  title: "Prepare fixture navigation",
  description: "Builds a navigation target without navigating or submitting anything.",
  inputSchema: {
    type: "object",
    properties: { value: { type: "string", minLength: 1 } },
    required: ["value"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute({ value }) {
    return navigationRequired(
      `https://example.test/prepare?value=${encodeURIComponent(value)}`,
      "Open the fixture page and review the prepared value manually."
    );
  }
};

const throwingTool: WebMcpTool = {
  name: "fixture_throw",
  title: "Throw a fixture exception",
  description: "Throws an unexpected exception so the shared wrapper can sanitize it.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute() {
    throw new Error("private fixture detail");
  }
};

export default defineSite({
  id: "fixture",
  title: "Fixture",
  version: "0.1.0",
  matches: ["https://example.test/*"],
  tools: [readTool, prepareTool, throwingTool]
});

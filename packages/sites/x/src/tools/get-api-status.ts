import type { WebMcpTool } from "@openwebmcp/common";
import { getNetworkStatus } from "../api/network";
import { textResult } from "../result";

export const getApiStatusTool: WebMcpTool = {
  name: "x_get_api_status",
  title: "Get X API status",
  description: "Reports which X GraphQL operations and posts have been observed in the current page session.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute() {
    return textResult(getNetworkStatus());
  }
};

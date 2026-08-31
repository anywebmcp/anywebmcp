import { completed, type WebMcpTool } from "@openwebmcp/common";
import { getNetworkStatus } from "../api/network";

export const getApiStatusTool: WebMcpTool = {
  name: "x_get_api_status",
  title: "Get X API status",
  description: "Returns diagnostic status for the current X page session.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute() {
    return completed(getNetworkStatus());
  }
};

import type { ToolDefinition } from "../providers/types.js";

export interface ToolContext {
  cwd: string;
  confirm?: boolean;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolDefinition["inputSchema"] & {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

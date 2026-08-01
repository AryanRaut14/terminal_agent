import type { ToolCall, ToolDefinition } from "../providers/types.js";
import { bashTool } from "./bash.js";
import { editTool } from "./edit.js";
import { readTool } from "./read.js";
import type { Tool, ToolContext, ToolResult } from "./types.js";
import { writeTool } from "./write.js";

export const coreTools: Tool[] = [readTool, writeTool, editTool, bashTool];

export function getToolDefinitions(tools: Tool[] = coreTools): ToolDefinition[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

export async function executeToolCall(
  call: ToolCall,
  tools: Tool[],
  ctx: ToolContext
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { content: `Error: unknown tool "${call.name}"`, isError: true };
  }

  try {
    return await tool.execute(call.input, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error executing ${call.name}: ${msg}`, isError: true };
  }
}

export type { Tool, ToolContext, ToolResult };

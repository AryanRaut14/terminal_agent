import OpenAI from "openai";
import type {
  ContentBlock,
  Message,
  Provider,
  ProviderRequest,
  ProviderResponse,
  ToolCall,
  ToolDefinition,
} from "./types.js";

const DEFAULT_MODEL = "gpt-4.1-mini";

function toOpenAIContent(blocks: ContentBlock[]): Array<{ type: string; text?: string; tool_call_id?: string; content?: string; name?: string; input?: Record<string, unknown> }> {
  return blocks.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };
    if (block.type === "tool_use") return { type: "tool_call", name: block.name, input: block.input };
    if (block.type === "tool_result") return { type: "tool_result", tool_call_id: block.toolUseId, content: block.content };
    throw new Error("Unsupported content block type");
  });
}

function toOpenAIMessage(message: Message): Record<string, unknown> {
  if (typeof message.content === "string") return { role: message.role, content: message.content };
  return { role: message.role, content: toOpenAIContent(message.content) };
}

function extractToolCalls(content: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }>): { text: string; toolCalls: ToolCall[] } {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const item of content) {
    if (item.type === "text") textParts.push(item.text ?? "");
    if (item.type === "tool_call") toolCalls.push({ id: `${item.name ?? "tool"}-call`, name: item.name ?? "", input: item.input ?? {} });
  }
  return { text: textParts.join(""), toolCalls };
}

export function createOpenAIProvider(apiKey?: string): Provider {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set. Add it to .env or your environment.");

  const client = new OpenAI({ apiKey: key });

  return {
    name: "openai",
    async sendMessage(request: ProviderRequest): Promise<ProviderResponse> {
      const response = await client.responses.create({
        model: request.model ?? DEFAULT_MODEL,
        input: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map(toOpenAIMessage),
        ],
        tools: (request.tools ?? []).map((tool: ToolDefinition) => ({
          type: "function" as const,
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        })),
      });

      const outputText = response.output_text ?? "";
      const toolCalls: ToolCall[] = [];
      const outputItems = (response as unknown as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }> }> }).output ?? [];
      for (const item of outputItems) {
        if (item.type === "function_call") {
          toolCalls.push({ id: item.name ?? "tool-call", name: item.name ?? "", input: item.input ?? {} });
        }
      }

      return { text: outputText, toolCalls, stopReason: "end_turn" };
    },
  };
}

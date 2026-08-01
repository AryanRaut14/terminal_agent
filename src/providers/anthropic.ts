import Anthropic from "@anthropic-ai/sdk";
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ToolCall,
  ToolDefinition,
} from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function toAnthropicTools(tools: ToolDefinition[] | undefined) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      ...t.inputSchema,
    },
  }));
}

function extractToolCalls(
  content: Anthropic.Message["content"]
): { text: string; toolCalls: ToolCall[] } {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  return { text: textParts.join(""), toolCalls };
}

export function createAnthropicProvider(apiKey?: string): Provider {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env or your environment."
    );
  }

  const client = new Anthropic({ apiKey: key });

  return {
    name: "anthropic",

    async sendMessage(request: ProviderRequest): Promise<ProviderResponse> {
      const response = await client.messages.create({
        model: request.model ?? DEFAULT_MODEL,
        max_tokens: 8192,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: toAnthropicTools(request.tools),
      });

      const { text, toolCalls } = extractToolCalls(response.content);

      return {
        text,
        toolCalls,
        stopReason: response.stop_reason ?? "end_turn",
      };
    },
  };
}

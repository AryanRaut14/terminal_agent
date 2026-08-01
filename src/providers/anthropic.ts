import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  Message,
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

function toAnthropicContent(
  blocks: ContentBlock[]
): Anthropic.MessageParam["content"] {
  return blocks.map((block) => {
    if (block.type === "text") {
      return { type: "text" as const, text: block.text };
    }
    if (block.type === "tool_use") {
      return {
        type: "tool_use" as const,
        id: block.id,
        name: block.name,
        input: block.input,
      };
    }
    if (block.type === "tool_result") {
      return {
        type: "tool_result" as const,
        tool_use_id: block.toolUseId,
        content: block.content,
        is_error: block.isError,
      };
    }
    throw new Error(`Unsupported content block type`);
  });
}

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    return { role: m.role, content: toAnthropicContent(m.content) };
  });
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
        messages: toAnthropicMessages(request.messages),
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

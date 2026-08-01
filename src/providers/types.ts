/** A block within a multi-part message (text, tool use, or tool result). */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

/** Provider-agnostic message in conversation history. */
export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

/** JSON-schema-style tool definition sent to the model. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool call requested by the model. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderRequest {
  systemPrompt: string;
  messages: Message[];
  tools?: ToolDefinition[];
  model?: string;
}

export interface ProviderResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: string;
}

/** Thin adapter interface — one implementation per LLM provider. */
export interface Provider {
  readonly name: string;
  sendMessage(request: ProviderRequest): Promise<ProviderResponse>;
}

export type ProviderName = "anthropic" | "openai" | "groq" | "gemini";

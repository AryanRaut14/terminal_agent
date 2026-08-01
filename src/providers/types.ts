/** Provider-agnostic message in conversation history. */
export interface Message {
  role: "user" | "assistant";
  content: string;
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

/** Result of executing a tool, sent back to the model. */
export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
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

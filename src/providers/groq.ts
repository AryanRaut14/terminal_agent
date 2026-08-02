import OpenAI from "openai";
import type { Provider, ProviderRequest, ProviderResponse, ToolCall, ToolDefinition } from "./types.js";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function createGroqProvider(apiKey?: string): Provider {
  const key = apiKey ?? process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set. Add it to .env or your environment.");

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });

  return {
    name: "groq",
    async sendMessage(request: ProviderRequest): Promise<ProviderResponse> {
      const response = await client.responses.create({
        model: request.model ?? DEFAULT_MODEL,
        input: [{ role: "system", content: request.systemPrompt }, ...request.messages.map((message) => ({ role: message.role, content: typeof message.content === "string" ? message.content : message.content.map((block) => (block.type === "text" ? { type: "text", text: block.text } : { type: "text", text: "" })).join("") }))],
        tools: (request.tools ?? []).map((tool: ToolDefinition) => ({ type: "function" as const, name: tool.name, description: tool.description, parameters: tool.inputSchema })),
      });

      const toolCalls: ToolCall[] = [];
      const outputText = response.output_text ?? "";
      return { text: outputText, toolCalls, stopReason: "end_turn" };
    },
  };
}

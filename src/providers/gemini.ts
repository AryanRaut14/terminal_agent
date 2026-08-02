import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Provider, ProviderRequest, ProviderResponse, ToolCall } from "./types.js";

const DEFAULT_MODEL = "gemini-2.0-flash";

export function createGeminiProvider(apiKey?: string): Provider {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set. Add it to .env or your environment.");

  const client = new GoogleGenerativeAI(key);

  return {
    name: "gemini",
    async sendMessage(request: ProviderRequest): Promise<ProviderResponse> {
      const model = client.getGenerativeModel({ model: request.model ?? DEFAULT_MODEL });
      const history = request.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof message.content === "string" ? message.content : message.content.map((block) => (block.type === "text" ? block.text : "")).join("") }],
      }));

      const result = await model.generateContent([{ role: "user", parts: [{ text: request.systemPrompt }] }, ...history]);
      const response = await result.response;
      const text = response.text();
      return { text, toolCalls: [], stopReason: "end_turn" };
    },
  };
}

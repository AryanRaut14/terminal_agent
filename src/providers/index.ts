import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { createGroqProvider } from "./groq.js";
import { createOpenAIProvider } from "./openai.js";
import type { Provider, ProviderName } from "./types.js";

export type {
  ContentBlock,
  Message,
  Provider,
  ProviderRequest,
  ProviderResponse,
} from "./types.js";

const PROVIDERS: ProviderName[] = ["anthropic", "openai", "groq", "gemini"];

export function createProvider(name: string): Provider {
  const normalized = name.toLowerCase() as ProviderName;

  if (!PROVIDERS.includes(normalized)) {
    throw new Error(
      `Unknown provider "${name}". Choose from: ${PROVIDERS.join(", ")}`
    );
  }

  switch (normalized) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      return createOpenAIProvider();
    case "groq":
      return createGroqProvider();
    case "gemini":
      return createGeminiProvider();
  }
}

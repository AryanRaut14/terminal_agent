import { createAnthropicProvider } from "./anthropic.js";
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
    case "groq":
    case "gemini":
      throw new Error(
        `Provider "${normalized}" is not implemented yet. Use --provider anthropic for now.`
      );
  }
}

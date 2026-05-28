/**
 * LLM Provider Factory
 * Handles multiple LLM providers (OpenAI, Grok, Gemini)
 */

export type LLMProvider = "openai" | "grok" | "gemini";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export interface LLMClient {
  provider: LLMProvider;
  getModel(): string;
  getClientConfig(): Record<string, unknown>;
}

class OpenAIClient implements LLMClient {
  provider: LLMProvider = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-3.5-turbo") {
    this.apiKey = apiKey;
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getClientConfig(): Record<string, unknown> {
    return {
      apiKey: this.apiKey,
      provider: "openai",
    };
  }
}

class GrokClient implements LLMClient {
  provider: LLMProvider = "grok";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "grok-3") {
    this.apiKey = apiKey;
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getClientConfig(): Record<string, unknown> {
    return {
      apiKey: this.apiKey,
      baseURL: "https://api.x.ai/v1",
      provider: "grok",
    };
  }
}

class GeminiClient implements LLMClient {
  provider: LLMProvider = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getClientConfig(): Record<string, unknown> {
    return {
      apiKey: this.apiKey,
      provider: "gemini",
    };
  }
}

/**
 * Create LLM client based on provider type
 */
export const createLLMClient = (provider: LLMProvider, apiKey: string, model?: string): LLMClient => {
  switch (provider) {
    case "openai":
      return new OpenAIClient(apiKey, model);
    case "grok":
      return new GrokClient(apiKey, model);
    case "gemini":
      return new GeminiClient(apiKey, model);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
};

/**
 * Get provider info for display
 */
export const getProviderInfo = (provider: LLMProvider): {
  name: string;
  description: string;
  keyFormat: string;
} => {
  const info: Record<LLMProvider, { name: string; description: string; keyFormat: string }> = {
    openai: {
      name: "OpenAI",
      description: "GPT-3.5-turbo / GPT-4 (Fast & Reliable)",
      keyFormat: "Must start with 'sk-'",
    },
    grok: {
      name: "Grok",
      description: "Grok-2 by xAI (Fast & Edgy)",
      keyFormat: "Must be valid xAI API key",
    },
    gemini: {
      name: "Gemini",
      description: "Google Gemini (Advanced & Multimodal)",
      keyFormat: "Must be valid Google API key",
    },
  };
  return info[provider];
};

/**
 * Validate API key format
 */
export const validateApiKey = (provider: LLMProvider, apiKey: string): { valid: boolean; error?: string } => {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: "API key cannot be empty" };
  }

  switch (provider) {
    case "openai":
      if (!apiKey.startsWith("sk-")) {
        return { valid: false, error: "OpenAI keys must start with 'sk-'" };
      }
      break;
    case "grok":
      if (apiKey.length < 20) {
        return { valid: false, error: "Grok API key seems too short" };
      }
      break;
    case "gemini":
      if (apiKey.length < 20) {
        return { valid: false, error: "Gemini API key seems too short" };
      }
      break;
  }

  return { valid: true };
};

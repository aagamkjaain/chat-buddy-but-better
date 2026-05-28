/**
 * Agent Factory
 * Creates and configures agents based on the selected LLM provider
 */
import type { Message } from "../storage/interfaces/ConversationStore.js";

export interface AgentResponse {
  finalOutput: string;
}

export interface AgentConfig {
  name: string;
  model: string;
  instructions: string;
  tools: any[];
  handoffs: any[];
}

/**
 * Create an agent based on the LLM provider
 * Currently only OpenAI is fully supported via @openai/agents
 * Grok and Gemini use compatible interfaces
 */
export const createAgent = async (
  config: AgentConfig,
): Promise<{
  run: (input: string) => Promise<AgentResponse>;
}> => {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(`No API key found for provider: ${provider}`);
  }

  if (provider === "openai") {
    // Use native @openai/agents
    const { Agent, run } = await import("@openai/agents");
    
    const agent = new Agent({
      name: config.name,
      model: config.model,
      instructions: config.instructions,
      tools: config.tools,
      handoffs: config.handoffs,
    });

    return {
      run: async (input: string) => {
        const result = await run(agent, input);
        return {
          finalOutput: result.finalOutput || "Sorry, I couldn't respond.",
        };
      },
    };
  } else if (provider === "grok") {
    // Grok via xAI API (compatible with OpenAI format)
    const { Agent, run } = await import("@openai/agents");
    
    const agent = new Agent({
      name: config.name,
      model: config.model,
      instructions: config.instructions,
      tools: config.tools,
      handoffs: config.handoffs,
    });

    return {
      run: async (input: string) => {
        // Grok uses OpenAI-compatible API
        process.env.OPENAI_API_KEY = apiKey;
        const result = await run(agent, input);
        return {
          finalOutput: result.finalOutput || "Sorry, I couldn't respond.",
        };
      },
    };
  } else if (provider === "gemini") {
    // Google Gemini via Vertex AI or direct API
    const { Agent, run } = await import("@openai/agents");
    
    const agent = new Agent({
      name: config.name,
      model: config.model,
      instructions: config.instructions,
      tools: config.tools,
      handoffs: config.handoffs,
    });

    return {
      run: async (input: string) => {
        // For Gemini, we use a compatibility layer
        process.env.OPENAI_API_KEY = apiKey;
        const result = await run(agent, input);
        return {
          finalOutput: result.finalOutput || "Sorry, I couldn't respond.",
        };
      },
    };
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
};

/**
 * Get provider-specific agent configuration
 */
export const getProviderAgentConfig = (baseConfig: AgentConfig): AgentConfig => {
  const provider = process.env.LLM_PROVIDER || "openai";
  const customModel = process.env.LLM_MODEL;

  // Use custom model if specified
  if (customModel) {
    baseConfig.model = customModel;
  }

  // Provider-specific adjustments
  switch (provider) {
    case "grok":
      // Grok is optimized for creative and edgy responses
      return {
        ...baseConfig,
        model: customModel || "grok-3",
        instructions:
          baseConfig.instructions +
          "\nNote: You have access to Grok's edgy and creative capabilities. Use them when appropriate.",
      };

    case "gemini":
      // Gemini is powerful for complex reasoning
      return {
        ...baseConfig,
        model: customModel || "gemini-2.0-flash",
        instructions:
          baseConfig.instructions +
          "\nNote: You're using Google Gemini, leverage its advanced capabilities for complex queries.",
      };

    case "openai":
    default:
      return {
        ...baseConfig,
        model: customModel || "gpt-3.5-turbo",
      };
  }
};

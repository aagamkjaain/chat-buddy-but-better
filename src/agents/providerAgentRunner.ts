/**
 * Provider-Aware Agent Runner
 * Routes to the appropriate LLM provider API
 */

export interface AgentRunOptions {
  name: string;
  model: string;
  instructions: string;
  input: string;
}

export interface AgentRunResult {
  finalOutput: string;
}

/**
 * Call Google Gemini API directly via REST
 */
const callGeminiAPI = async (
  apiKey: string,
  model: string,
  instructions: string,
  input: string,
): Promise<string> => {
  // Ensure model name doesn't have "models/" prefix (we'll add it in URL)
  const modelName = model.startsWith("models/") ? model.split("/")[1] : model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${instructions}\n\n${input}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.error?.reason || response.statusText;
      } catch {
        // If error response is not JSON, use status text
      }
      throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    return "Sorry, I couldn't generate a response.";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Gemini API Error:", errorMsg);
    throw new Error(`Failed to call Gemini API: ${errorMsg}`);
  }
};

/**
 * Call OpenAI-compatible API (OpenAI or Grok)
 */
const callOpenAICompatibleAPI = async (
  apiKey: string,
  baseUrl: string,
  model: string,
  instructions: string,
  input: string,
): Promise<string> => {
  const url = `${baseUrl}/chat/completions`;
  const isGrok = baseUrl.includes("api.x.ai");

  // Validate and log payload details
  console.log(`[${model}] Instructions length: ${instructions.length} chars`);
  console.log(`[${model}] Input length: ${input.length} chars`);
  console.log(`[${model}] Total combined length: ${(instructions + input).length} chars`);
  console.log(`[API-DEBUG] Using:`, {
    provider: process.env.LLM_PROVIDER,
    model: model,
    baseUrl: baseUrl,
    apiKeyPrefix: apiKey.substring(0, 15) + "...",
    apiKeyLength: apiKey.length,
  });

  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: instructions,
      },
      {
        role: "user",
        content: input,
      },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  };

  try {
    console.log(`[${model}] Calling ${url}`);
    console.log(`[${model}] Request headers:`, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.substring(0, 10)}...`,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      let errorDetails = "";
      
      try {
        const errorData = await response.json();
        console.error(`[${model}] Error response:`, JSON.stringify(errorData, null, 2));
        errorMessage = errorData.error?.message || errorData.detail || errorData.message || response.statusText;
        if (errorData.error && typeof errorData.error === "object") {
          errorDetails = JSON.stringify(errorData.error);
        }
      } catch (parseError) {
        // If error response is not JSON, try to get text
        try {
          const errorText = await response.text();
          console.error(`[${model}] Error body:`, errorText);
          errorMessage = errorText || response.statusText;
        } catch {
          // If even text parsing fails, use status text
        }
      }
      
      // For Grok, try alternative format if standard format fails with 400
      if (isGrok && response.status === 400) {
        console.log(`[${model}] Trying alternative payload format without system role...`);
        return await callOpenAICompatibleAPI_NoSystemRole(apiKey, baseUrl, model, instructions, input);
      }
      
      throw new Error(`API error (${response.status}): ${errorMessage}${errorDetails ? ` | ${errorDetails}` : ""}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    return "Sorry, I couldn't generate a response.";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${model}] OpenAI-compatible API Error:`, errorMsg);
    throw new Error(`Failed to call API: ${errorMsg}`);
  }
};

/**
 * Alternative Grok API call without system role (in case Grok doesn't support it)
 */
const callOpenAICompatibleAPI_NoSystemRole = async (
  apiKey: string,
  baseUrl: string,
  model: string,
  instructions: string,
  input: string,
): Promise<string> => {
  const url = `${baseUrl}/chat/completions`;
  
  // Combine instructions and input into a single user message
  const combinedMessage = `${instructions}\n\n${input}`;

  const payload = {
    model: model,
    messages: [
      {
        role: "user",
        content: combinedMessage,
      },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  };

  try {
    console.log(`[${model}] Attempting alternative format (combined user message)...`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        console.error(`[${model}] Alternative format error:`, JSON.stringify(errorData, null, 2));
        errorMessage = errorData.error?.message || errorData.detail || errorData.message || response.statusText;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || response.statusText;
      }
      
      throw new Error(`Alternative format failed (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0]?.message?.content) {
      console.log(`[${model}] ✓ Alternative format succeeded!`);
      return data.choices[0].message.content;
    }

    return "Sorry, I couldn't generate a response.";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${model}] Alternative format error:`, errorMsg);
    throw new Error(`Failed to call API (both formats): ${errorMsg}`);
  }
};

/**
 * Run agent based on provider
 */
export const runProviderAgent = async (
  options: AgentRunOptions,
): Promise<AgentRunResult> => {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  console.log(`Using LLM Provider: ${provider}, Model: ${options.model}`);

  let output: string;
  let actualModel = options.model;

  if (provider === "gemini") {
    // Use Gemini API
    console.log("Calling Gemini API...");
    output = await callGeminiAPI(apiKey, actualModel, options.instructions, options.input);
  } else if (provider === "grok") {
    // Use Grok via xAI's OpenAI-compatible endpoint
    // Use xAI's grok-3 model (grok-2-1212 no longer exists)
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.x.ai/v1";
    console.log(`Calling Grok API at ${baseUrl}... (model: ${actualModel})`);
    output = await callOpenAICompatibleAPI(apiKey, baseUrl, actualModel, options.instructions, options.input);
  } else {
    // Use OpenAI (default)
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    console.log(`Calling OpenAI API at ${baseUrl}...`);
    output = await callOpenAICompatibleAPI(apiKey, baseUrl, actualModel, options.instructions, options.input);
  }

  return {
    finalOutput: output,
  };
};

/**
 * Get provider-specific base URL
 */
export const getProviderBaseUrl = (): string => {
  const provider = process.env.LLM_PROVIDER || "openai";

  switch (provider) {
    case "grok":
      return "https://api.x.ai/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "openai":
    default:
      return "https://api.openai.com/v1";
  }
};

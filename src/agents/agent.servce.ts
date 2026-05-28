/**
 * Core Agent Service
 * Initializes and executes the main LLM agent with custom personality traits,
 * tools, and handoff logic for responding to user messages.
 * Supports multiple LLM providers: OpenAI, Grok, and Gemini
 */
import { createProtocols } from "../config/agent.protocol.js";
import { runProviderAgent } from "./providerAgentRunner.js";
import { withRequesterContext } from "../storage/runContext.js";
import { getLatestMeetingForRequesterSince } from "../storage/sessionMeetingStore.js";
import { getContext, saveContext } from "../services/conversationService.js";
import type { Message } from "../storage/interfaces/ConversationStore.js";

const formatSessionMessage = (message: Message, contactName: string): string => {
  const timeStr = new Date(message.timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const speaker = message.role === "assistant" ? "assistant" : contactName;
  return `[${timeStr}] ${speaker}: ${message.content}`;
};

/**
 * Get the appropriate model name based on LLM provider
 */
const getModelForProvider = (): string => {
  const provider = process.env.LLM_PROVIDER || "openai";
  const customModel = process.env.LLM_MODEL;

  if (customModel) {
    return customModel;
  }

  switch (provider) {
    case "grok":
      return "grok-3"; // xAI's latest Grok model
    case "gemini":
      return "gemini-2.0-flash";
    case "openai":
    default:
      return "gpt-3.5-turbo";
  }
};

/**
 * Ensure API key is properly set for the selected provider
 */
const ensureApiKeyForProvider = (): void => {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }
};

export const runAgent = async (
  userId: string,
  contactName: string,
  userMessage: string,
  username: string = "Asad",
  agentName: string = "Luffy",
): Promise<string> => {
  // Ensure API key is set before creating the agent
  ensureApiKeyForProvider();

  const protocols = createProtocols(agentName, username);

  const sessionHistory = await getContext(userId);
  const historyContext =
    sessionHistory.length > 0
      ? `Previous conversation:\n${sessionHistory.map((message) => formatSessionMessage(message, contactName)).join("\n")}`
      : "No previous conversation.";

  const model = getModelForProvider();
  const provider = process.env.LLM_PROVIDER || "openai";

  // Build instructions
  let instructions = `
You are ${protocols.name}, an AI assistant built by ${username}.
Your personality traits:
- Casual, funny, and street-smart — like a real friend, not a robot.
- Energetic and cheerful but with meme-lord energy.
- Loyal, protective, and always got ${username}'s back.
- Confident, fearless, and savage when the vibe calls for it.
- You're helpful AF — assist with plans, coding, writing, ideas, anything.
- NEVER use offensive/abusive language FIRST. But if the user throws gaali or roasts, match their energy and fire back equally or funnier.
- Think of yourself as a mirror — reflect whatever vibe the user brings.
${protocols.description}
- Otherwise, respond normally.
- Keep responses short and conversational (WhatsApp style).
- Always generate ISO datetime using Asia/Kolkata timezone (UTC+05:30).
- If the user says bye, goodbye, or similar, respond with a proper farewell.
- NEVER say "hey", "hello", or "hi" unless the user greeted first.`;

  // Add provider-specific guidance
  if (provider === "grok") {
    instructions += "\n\nProvider Note: You're powered by Grok (xAI). Feel free to be edgy and creative with your responses.";
  } else if (provider === "gemini") {
    instructions += "\n\nProvider Note: You're powered by Google Gemini. Use advanced reasoning when needed.";
  }

  const input = `${historyContext}\n\nUser: ${userMessage}`;

  const runStartedAt = Date.now();

  // Use provider-aware agent runner
  const result = await withRequesterContext(contactName, () =>
    runProviderAgent({
      name: protocols.name,
      model: model,
      instructions: instructions,
      input: input,
    }),
  );

  let finalOutput = result.finalOutput || "Sorry, I couldn't respond.";

  const latestMeeting = getLatestMeetingForRequesterSince(contactName, runStartedAt);
  if (latestMeeting && !finalOutput.includes(latestMeeting.meetLink)) {
    finalOutput = `${finalOutput}\nMeet link: ${latestMeeting.meetLink}\nMeeting time: ${latestMeeting.meetingTime}`;
  }

  await saveContext(userId, [
    ...sessionHistory,
    {
      role: "user",
      content: userMessage,
      timestamp: runStartedAt,
    },
    {
      role: "assistant",
      content: finalOutput,
      timestamp: Date.now(),
    },
  ]);

  return finalOutput;
};

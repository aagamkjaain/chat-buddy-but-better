/**
 * Run
 */
import pc from "picocolors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { loadConfig, configExists, BotConfig } from "../storage/configStore.js";
import { WhatsAppBot } from "../bot.js";
import { resolveAuthContext } from "../auth/googleAuth.js";
import { getProviderInfo } from "../config/llmProvider.js";

const envPath = path.join(process.cwd(), ".env");
const envPathAlt = path.join(process.cwd(), "env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envPathAlt)) {
  dotenv.config({ path: envPathAlt });
}

export const runBot = async (): Promise<void> => {
  console.log();

  let llmApiKey: string | undefined;
  let llmProvider: string = "openai";
  let llmModel: string | undefined;
  let username: string = "User";
  let agentName: string = "Assistant";
  let config: BotConfig | null = null;

  if (configExists()) {
    config = loadConfig();
    if (config) {
      llmApiKey = config.llmApiKey;
      llmProvider = config.llmProvider;
      llmModel = config.llmModel;
      username = config.username;
      agentName = config.agentName;
      
      const providerInfo = getProviderInfo(config.llmProvider);
      console.log(
        pc.green(`  ✓ Config loaded for ${pc.bold(username)} with agent ${pc.bold(agentName)}`),
      );
      console.log(
        pc.green(`  ✓ Using ${pc.bold(providerInfo.name)} as LLM provider`),
      );
    } else {
      console.log(pc.yellow("  ⚠ Config found but could not be decrypted. Falling back to .env"));
    }
  } else {
    console.log(pc.yellow("  ⚠ No config found. Checking .env file..."));
  }

  // Fallback to environment variables
  if (!llmApiKey) {
    llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  }

  if (!llmProvider && process.env.LLM_PROVIDER) {
    llmProvider = process.env.LLM_PROVIDER;
  }

  if (!llmModel && process.env.LLM_MODEL) {
    llmModel = process.env.LLM_MODEL;
  }

  if (!llmApiKey) {
    console.log(pc.red("  ✗ LLM API key not found!"));
    console.log(
      pc.dim("    Run 'chat-buddy init' to set up, or set LLM_API_KEY in .env"),
    );
    process.exit(1);
  }

  // Set environment variables for the agent to use
  process.env.LLM_PROVIDER = llmProvider;
  process.env.LLM_API_KEY = llmApiKey;
  if (llmModel) {
    process.env.LLM_MODEL = llmModel;
  }
  
  // Set provider-specific environment variables (DO NOT set OPENAI_API_KEY for non-OpenAI providers)
  if (llmProvider === "openai") {
    process.env.OPENAI_API_KEY = llmApiKey;
  } else if (llmProvider === "grok") {
    // Grok uses OpenAI-compatible API with xAI endpoint
    process.env.OPENAI_API_KEY = llmApiKey;
    process.env.OPENAI_BASE_URL = "https://api.x.ai/v1";
  } else if (llmProvider === "gemini") {
    // Gemini uses Google's API
    process.env.GEMINI_API_KEY = llmApiKey;
  }

  const googleAuth = resolveAuthContext(config || undefined);
  if (!googleAuth) {
    console.log(
      pc.yellow(
        "  ⚠ Google Calendar integration is disabled or credentials not found. Calendar features will be disabled.",
      ),
    );
  } else {
    console.log(pc.green(`  ✓ Google Calendar features enabled (${googleAuth.source}).`));
  }

  console.log();
  console.log(pc.dim("  Starting WhatsApp bot... Scan the QR code when it appears."));
  console.log();

  const bot = new WhatsAppBot(username, agentName);
  bot.start();
};

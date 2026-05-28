/**
 * Init
 */
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import ora from "ora";
import pc from "picocolors";
import { saveConfig, configExists, type BotConfig } from "../storage/configStore.js";
import { getProviderInfo, validateApiKey, type LLMProvider } from "../config/llmProvider.js";

const banner = ` ██████╗██╗  ██╗ █████╗ ████████╗   ██████╗ ██╗   ██╗██████╗ ██████╗ ██╗   ██╗
██╔════╝██║  ██║██╔══██╗╚══██╔══╝   ██╔══██╗██║   ██║██╔══██╗██╔══██╗╚██╗ ██╔╝
██║     ███████║███████║   ██║█████╗██████╔╝██║   ██║██║  ██║██║  ██║ ╚████╔╝ 
██║     ██╔══██║██╔══██║   ██║╚════╝██╔══██╗██║   ██║██║  ██║██║  ██║  ╚██╔╝  
╚██████╗██║  ██║██║  ██║   ██║      ██████╔╝╚██████╔╝██████╔╝██████╔╝   ██║   
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝   
                                                                              `;

const center = (text: string, width: number) =>
  text
    .split("\n")
    .map((line) => {
      const pad = Math.max(0, Math.floor((width - line.length) / 2));
      return " ".repeat(pad) + line;
    })
    .join("\n");

const ask = async (rl: readline.Interface, question: string): Promise<string> => {
  const answer = await rl.question(pc.cyan(`  ➤ ${question}: `));
  return answer.trim();
};

export const runInit = async (): Promise<void> => {
  const width = process.stdout.columns ?? 80;

  console.clear();
  console.log(pc.green(center(banner.trim(), width)));
  console.log();
  console.log(pc.bold(pc.green(center("🤖 Chat-Buddy — Setup Wizard", width))));
  console.log(pc.dim(center("────────────────────────────────────", width)));
  console.log();

  if (configExists()) {
    console.log(pc.yellow("  ⚠ A configuration already exists. Running init will overwrite it."));
    console.log();
  }

  const rl = readline.createInterface({ input, output });

  try {
    console.log(pc.bold(pc.white("  📋 Step 1: Your Identity")));
    const username = await ask(rl, "Enter your name (e.g. Asad)");
    if (!username) {
      console.log(pc.red("  ✗ Username is required."));
      rl.close();
      return;
    }
    console.log();

    console.log(pc.bold(pc.white("  🤖 Step 2: Agent Configuration")));
    const agentName = await ask(rl, "Enter your agent's name (e.g. Luffy)");
    if (!agentName) {
      console.log(pc.red("  ✗ Agent name is required."));
      rl.close();
      return;
    }
    console.log();

    console.log(pc.bold(pc.white("  🔑 Step 3: LLM Provider Selection")));
    console.log(pc.dim("     Choose your AI model provider:"));
    console.log(pc.dim("     1) OpenAI (gpt-3.5-turbo) - Fast & Reliable"));
    console.log(pc.dim("     2) Grok (Grok-2 by xAI) - Fast & Edgy"));
    console.log(pc.dim("     3) Gemini (Google Gemini) - Advanced & Multimodal"));
    console.log();

    let llmProvider: LLMProvider = "openai";
    const providerChoice = await ask(rl, "Select LLM provider (1/2/3)");

    switch (providerChoice) {
      case "1":
        llmProvider = "openai";
        break;
      case "2":
        llmProvider = "grok";
        break;
      case "3":
        llmProvider = "gemini";
        break;
      default:
        console.log(pc.yellow("  ⚠ Invalid choice. Defaulting to OpenAI."));
        llmProvider = "openai";
    }

    const providerInfo = getProviderInfo(llmProvider);
    console.log(pc.blue(`  Selected: ${providerInfo.name} - ${providerInfo.description}`));
    console.log();

    console.log(pc.bold(pc.white("  🔐 Step 4: API Key Setup")));
    console.log(pc.dim("     Your keys are encrypted using AES-256 and stored locally."));
    console.log(pc.dim("     They are never sent anywhere except to the respective API services."));
    console.log(pc.dim(`     Format: ${providerInfo.keyFormat}`));
    console.log();

    let llmApiKey = "";
    let valid = false;

    while (!valid) {
      llmApiKey = await ask(rl, `Enter your ${providerInfo.name} API key`);
      const validation = validateApiKey(llmProvider, llmApiKey);
      if (validation.valid) {
        valid = true;
      } else {
        console.log(pc.red(`  ✗ ${validation.error}`));
      }
    }
    console.log();

    console.log(pc.dim("     Google Calendar Integration requires OAuth 2.0 Credentials."));
    const enableGoogleAns = await ask(rl, "Enable Google Calendar integration? (y/N)");
    const enableGoogleCalendar = enableGoogleAns.toLowerCase() === "y";
    let googleOAuthClientId: string | undefined;
    let googleOAuthClientSecret: string | undefined;

    if (enableGoogleCalendar) {
      googleOAuthClientId = await ask(rl, "Google OAuth Client ID");
      googleOAuthClientSecret = await ask(rl, "Google OAuth Client Secret");
      if (!googleOAuthClientId || !googleOAuthClientSecret) {
        console.log(
          pc.red("  ✗ Client ID and Client Secret are required when Google Calendar is enabled."),
        );
        rl.close();
        return;
      }
    }
    console.log();

    rl.close();

    const spinner = ora({ text: "Encrypting and saving configuration...", color: "green" }).start();
    await new Promise((r) => setTimeout(r, 800));

    const config: BotConfig = {
      configVersion: 3,
      username,
      agentName,
      llmProvider,
      llmApiKey,
      llmModel: undefined,
      enableGoogleCalendar,
      googleOAuthClientId,
      googleOAuthClientSecret,
      allowGroupReplies: false,
      timezone: "Asia/Kolkata",
    };

    saveConfig(config);
    spinner.succeed("Configuration saved securely!");

    console.log();
    console.log(pc.green("  ✓ Setup complete! Your bot is ready."));
    console.log();
    console.log(pc.dim("  To start the bot, run:"));
    console.log(pc.bold(pc.cyan("    chat-buddy run")));
    console.log();
    console.log(pc.dim("  You'll be prompted to scan a WhatsApp QR code."));
    console.log();
  } catch (error) {
    rl.close();
    throw error;
  }
};

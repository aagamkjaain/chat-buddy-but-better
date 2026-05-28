/**
 * Bot
 */
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { handleMessages } from "./services/messageHandler.service.js";
import { getBanner } from "./utils/banner.js";
import { getStorageDir } from "./storage/configStore.js";

type ClientType = import("whatsapp-web.js").Client;

const { Client, LocalAuth } = pkg;

export class WhatsAppBot {
  private client: ClientType;
  private username: string;
  private agentName: string;
  private lastSelfMessageTimestamp: number = 0;
  private lastSelfMessageContent: string = ""; // Track last message content for deduplication
  private selfMessagePollerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(username: string = "User", agentName: string = "Assistant") {
    this.username = username;
    this.agentName = agentName;

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: getStorageDir() }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        timeout: 60000,
      },
    });

    this.initializeEvents();
  }

  /**
   * Poll the Saved Messages chat for new messages
   * Since WhatsApp Web.js doesn't trigger message events for self-chat,
   * we need to manually check for new messages periodically
   */
  private async pollSavedMessages() {
    try {
      // Try different methods to get chats
      let chats: any[] = [];
      
      // Method 1: Try getAllChats (latest versions)
      if (typeof (this.client as any).getAllChats === "function") {
        try {
          chats = await (this.client as any).getAllChats();
          console.log(`[SELF-POLLER] getAllChats returned ${chats.length} chats`);
        } catch (err) {
          console.log(`[SELF-POLLER] getAllChats failed:`, err instanceof Error ? err.message : err);
        }
      }
      
      // Method 2: Try getChats (older versions)
      if (chats.length === 0 && typeof (this.client as any).getChats === "function") {
        try {
          chats = await (this.client as any).getChats();
          console.log(`[SELF-POLLER] getChats returned ${chats.length} chats`);
        } catch (err) {
          console.log(`[SELF-POLLER] getChats failed:`, err instanceof Error ? err.message : err);
        }
      }
      
      if (chats.length === 0) {
        console.log("[SELF-POLLER] No chats accessible with available methods");
        return;
      }

      console.log(`[SELF-POLLER] Checking ${chats.length} chats for self-messages...`);
      
      // Iterate through all chats looking for self-messages
      for (const chat of chats) {
        try {
          // Skip broadcast/group chats
          const chatId = (chat as any).id?._serialized || (chat as any).id || "";
          if (chatId.includes("@g.us") || chatId.includes("@broadcast")) {
            continue;
          }

          // Fetch recent messages from this chat
          const messages = await (chat as any).fetchMessages?.({ limit: 5 }) || [];
          
          for (const msg of messages) {
            // Check if it's a new self-message (fromMe = true)
            const msgTimestamp = (msg as any).timestamp * 1000 || 0;
            const msgBody = (msg as any).body?.trim() || "(no body)";
            
            // Skip bot confirmation messages (they start with [✓] or [SAVED])
            if (msgBody.startsWith("[✓]") || msgBody.startsWith("[SAVED]")) {
              console.log(`[SELF-POLLER] Ignoring bot confirmation: "${msgBody.substring(0, 50)}"`);
              continue;
            }
            
            // Check if it's a new message (newer timestamp)
            if ((msg as any).fromMe && msgTimestamp > this.lastSelfMessageTimestamp) {
              
              // Deduplication: skip if same message content as last time
              if (msgBody === this.lastSelfMessageContent) {
                console.log(`[SELF-POLLER] Skipping duplicate: "${msgBody.substring(0, 50)}"`);
                this.lastSelfMessageTimestamp = msgTimestamp; // Update timestamp anyway
                continue;
              }
              
              console.log(`📝 [SELF-POLLER] New self-message: "${msgBody.substring(0, 50)}"`);
              
              // Process the message
              await handleMessages(msg as any, this.username, this.agentName);
              
              // Update tracking
              this.lastSelfMessageTimestamp = msgTimestamp;
              this.lastSelfMessageContent = msgBody;
              
              // Send confirmation to the Saved Messages chat
              await this.sendSelfMessageConfirmation(chat, msgBody);
            }
          }
        } catch (err) {
          // Skip chats we can't access
          continue;
        }
      }
    } catch (err) {
      console.error("[SELF-POLLER] Error polling saved messages:", err instanceof Error ? err.message : err);
    }
  }

  /**
   * Send a confirmation message to the Saved Messages chat
   */
  private async sendSelfMessageConfirmation(chat: any, originalMessage: string) {
    try {
      const timestamp = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
      
      const confirmationMsg = `[✓] Saved: "${originalMessage.substring(0, 50)}${originalMessage.length > 50 ? "..." : ""}" at ${timestamp}`;
      
      await (chat as any).sendMessage?.(confirmationMsg);
      console.log(`[SELF-POLLER] Sent confirmation: "${confirmationMsg}"`);
    } catch (err) {
      console.error("[SELF-POLLER] Error sending confirmation:", err instanceof Error ? err.message : err);
    }
  }

  /**
   * Start the poller for saved messages
   */
  private startSelfMessagePoller() {
    if (this.selfMessagePollerInterval) {
      clearInterval(this.selfMessagePollerInterval);
    }

    console.log("[SELF-POLLER] Starting saved messages poller (every 5 seconds)...");
    
    // Poll every 5 seconds
    this.selfMessagePollerInterval = setInterval(() => {
      this.pollSavedMessages().catch((err) => {
        console.error("[SELF-POLLER] Polling error:", err);
      });
    }, 5000);
  }

  /**
   * Stop the poller
   */
  private stopSelfMessagePoller() {
    if (this.selfMessagePollerInterval) {
      clearInterval(this.selfMessagePollerInterval);
      this.selfMessagePollerInterval = null;
      console.log("[SELF-POLLER] Stopped saved messages poller");
    }
  }

  private initializeEvents() {
    this.client.on("qr", (qr) => {
      console.log("Scan QR to login:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", async () => {
      try {
        console.clear();
        await getBanner(this.agentName, this.username);
        
        // Start polling for self-messages
        this.startSelfMessagePoller();
      } catch (err) {
        console.log(err);
      }
    });

    this.client.on("auth_failure", (msg) => {
      console.log("Auth failed:", msg);
    });

    this.client.on("disconnected", (reason) => {
      console.log("Disconnected:", reason);
      
      // Stop the poller when disconnected
      this.stopSelfMessagePoller();
      
      console.log("Reconnecting...");
      this.client.initialize();
    });

    this.client.on("message", async (message) => {
      try {
        // Log all incoming messages for debugging
        console.log(`[ALL MSG] FromMe: ${message.fromMe}, Body: ${message.body?.substring(0, 50) || "(no body)"}`);
        
        await handleMessages(message, this.username, this.agentName);
      } catch (err) {
        console.log("Message error:", err);
      }
    });
  }

  public start() {
    this.client.initialize().catch((err) => {
      console.log(err);
    });
  }

  /**
   * Gracefully shutdown the bot
   */
  public async shutdown() {
    console.log("Shutting down bot...");
    this.stopSelfMessagePoller();
    
    try {
      // Try to logout/destroy the client
      if ((this.client as any).logout) {
        await (this.client as any).logout();
      } else if ((this.client as any).destroy) {
        await (this.client as any).destroy();
      }
    } catch (err) {
      console.error("Error shutting down client:", err instanceof Error ? err.message : err);
    }
  }
}

export const botRebootTime = Date.now();

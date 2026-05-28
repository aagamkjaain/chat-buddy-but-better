/**
 * Message Handler Service
 * Processes incoming WhatsApp messages, handles debouncing for rapid consecutive texts,
 * filters unwanted messages, and orchestrates agent responses and commands.
 */
import { runAgent } from "../agents/agent.servce.js";
import { botRebootTime } from "../bot.js";
import { createProtocols } from "../config/agent.protocol.js";
import { storeMessage } from "./memory.service.js";
import { handleCommand } from "./command.service.js";

type MessageType = import("whatsapp-web.js").Message;

type PendingUserReply = {
  messages: string[];
  latestMessage: MessageType;
  contactName: string;
  username: string;
  agentName: string;
  timer: ReturnType<typeof setTimeout> | null;
  processing: boolean;
};

const pendingReplies = new Map<string, PendingUserReply>();

const getDebounceMs = (): number => {
  const value = Number(process.env.CHAT_BUDDY_RESPONSE_DEBOUNCE_MS ?? "2200");
  if (!Number.isFinite(value)) return 2200;
  if (value < 300) return 300;
  if (value > 15000) return 15000;
  return Math.floor(value);
};

/**
 * Check if a message is from a self-chat (Saved Messages / "You" chat)
 * Properly detects when you message yourself using WhatsApp's "Message Yourself" feature
 */
const isSelfChat = async (message: MessageType): Promise<boolean> => {
  try {
    const messageObj = message as any;
    
    // Get the chat for this message
    const chat = await (messageObj.getChat?.() || messageObj.chat?.());
    
    if (!chat) {
      console.log(`[SELF-DEBUG] Could not get chat object`);
      return false;
    }
    
    // Try to get current user's ID
    const client = messageObj._client || messageObj.client;
    let myJid: string | null = null;
    
    if (client?.info?.wid?._serialized) {
      myJid = client.info.wid._serialized;
    } else if (client?.info?.wid) {
      myJid = client.info.wid;
    }
    
    const chatId = chat?.id?._serialized || chat?.id;
    
    console.log(`[SELF-DEBUG] Checking:`, {
      chatId: chatId,
      myJid: myJid,
      fromMe: message.fromMe,
      chatName: chat?.name,
      isGroup: chat?.isGroup,
    });
    
    // Most reliable: Check if chat ID matches your own JID
    // This is the "Message Yourself" / Saved Messages feature
    if (myJid && chatId && chatId === myJid) {
      console.log(`[SELF] ✅ Detected self-chat via chat.id === myJid`);
      return true;
    }
    
    // Fallback: Check if fromMe (old method, less reliable)
    if (message.fromMe) {
      console.log(`[SELF] ⚠️ Detected via fromMe flag (fallback)`);
      return true;
    }
    
    console.log(`[SELF] ❌ Not a self-message`);
    return false;
  } catch (err) {
    console.error("[SELF-ERROR] Error checking if self-chat:", err);
    return false;
  }
};

const scheduleBufferedReply = (userId: string): void => {
  const pending = pendingReplies.get(userId);
  if (!pending) return;

  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  pending.timer = setTimeout(() => {
    void flushBufferedReply(userId);
  }, getDebounceMs());
};

const flushBufferedReply = async (userId: string): Promise<void> => {
  const pending = pendingReplies.get(userId);
  if (!pending) return;

  if (pending.processing) {
    scheduleBufferedReply(userId);
    return;
  }

  if (pending.messages.length === 0) {
    pendingReplies.delete(userId);
    return;
  }

  const batchedInput = pending.messages.join("\n");
  const { latestMessage, contactName, username, agentName } = pending;
  pending.messages = [];
  pending.timer = null;
  pending.processing = true;

  try {
    const reply = await runAgent(userId, contactName, batchedInput, username, agentName);

    storeMessage(contactName, reply, true);

    await latestMessage.reply(reply);
  } catch (error) {
    console.log("Tripwire triggered:", error);
    await latestMessage.reply("I cannot respond to that request.");
  } finally {
    pending.processing = false;

    if (pending.messages.length > 0) {
      scheduleBufferedReply(userId);
    } else {
      pendingReplies.delete(userId);
    }
  }
};

export const handleMessages = async (
  message: MessageType,
  username: string = "Asad",
  agentName: string = "Luffy",
): Promise<void> => {
  // Skip bot confirmation messages
  if (message.body && (message.body.startsWith("[✓]") || message.body.startsWith("[SAVED]"))) {
    console.log(`[MSG-HANDLER] Skipping bot confirmation: "${message.body.substring(0, 50)}"`);
    return;
  }

  // Track self-messages (Saved Messages in WhatsApp) separately
  // Check both fromMe property and if it's a self-chat (message from yourself)
  const isSelfMessage = message.fromMe || (await isSelfChat(message));
  
  console.log(`[MSG-HANDLER] isSelfMessage: ${isSelfMessage}, fromMe: ${message.fromMe}, body: ${message.body?.substring(0, 30) || "(empty)"}`);

  // SAVED MESSAGES ONLY MODE: Set to true to process only self-messages
  const SAVED_MESSAGES_ONLY = process.env.CHAT_BUDDY_SAVED_MESSAGES_ONLY === "true";
  
  if (isSelfMessage) {
    if (!message.body) {
      console.log(`[SELF] Skipping - no body`);
      return;
    }
    
    const text = message.body.trim();
    const selfContactName = "Self (Saved Messages)";
    
    storeMessage(selfContactName, text, false);
    console.log(`📝 [Self Note]: ${text}`);
    
    // If in Saved Messages Only mode, process this message with the agent
    if (SAVED_MESSAGES_ONLY) {
      console.log(`[SELF-AGENT] Processing self-message in Saved Messages mode`);
      const userId = message.from;
      
      // Add to pending replies for processing
      if (!pendingReplies.has(userId)) {
        pendingReplies.set(userId, {
          messages: [],
          latestMessage: message,
          contactName: selfContactName,
          username,
          agentName,
          timer: null,
          processing: false,
        });
      }
      
      const pending = pendingReplies.get(userId)!;
      pending.messages.push(text);
      pending.latestMessage = message;
      scheduleBufferedReply(userId);
      return;
    }
    
    return; // Don't process/respond to self-messages in normal mode
  }

  // Allow messages from the last hour (not just after bot start)
  // This prevents filtering out recent messages from chat history
  const oneHourAgo = Date.now() - 3600000; // 1 hour in milliseconds
  if (message.timestamp * 1000 < oneHourAgo) {
    console.log(`[MSG-HANDLER] Skipping - message too old (older than 1 hour)`);
    return;
  }

  if (!message.body) {
    console.log(`[MSG-HANDLER] Skipping - no body`);
    return;
  }

  const userId = message.from;
  const text = message.body.trim();
  const textLower = text.toLowerCase();

  const protocols = createProtocols(agentName, username);

  if (
    (message.from.endsWith("@g.us") && !protocols.allowGroupReplies) ||
    message.from === "status@broadcast"
  ) {
    console.log(`[MSG-HANDLER] Skipping - group or status broadcast`);
    return;
  }

  const contact = await message.getContact();
  const contactName = contact.pushname || contact.number;
  console.log(`${contactName}: ${text}`);
  
  // Debug: Log message metadata for self-message detection
  console.log(`[DEBUG] Message from: ${message.from}, fromMe: ${message.fromMe}`);
  const messageObj = message as any;
  if (messageObj._data) {
    console.log(`[DEBUG] Message _data properties:`, {
      isFromMe: messageObj._data.isFromMe,
      from: messageObj._data.from,
    });
  }

  storeMessage(contactName, text, false);

  if (textLower.startsWith("/")) {
    await handleCommand(message, textLower);
    return;
  }

  const existing = pendingReplies.get(userId);
  if (!existing) {
    pendingReplies.set(userId, {
      messages: [text],
      latestMessage: message,
      contactName,
      username,
      agentName,
      timer: null,
      processing: false,
    });
  } else {
    existing.messages.push(text);
    existing.latestMessage = message;
    existing.contactName = contactName;
    existing.username = username;
    existing.agentName = agentName;
  }

  scheduleBufferedReply(userId);
};

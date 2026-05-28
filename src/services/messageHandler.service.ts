/**
 * Message Handler Service
 * Processes incoming WhatsApp messages and self-messages only.
 * Only messages sent to yourself ("Message Yourself" chat) are processed.
 * All other messages from contacts/groups are completely ignored.
 */
import { runAgent } from "../agents/agent.servce.js";
import { storeMessage } from "./memory.service.js";

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
  
  console.log(`[MSG-HANDLER] Checking message: self=${isSelfMessage}, body="${message.body?.substring(0, 30) || "(empty)"}"`);

  // ⭐ SELF-MESSAGES ONLY MODE (DEFAULT)
  // Bot only processes messages you send to yourself in "Message Yourself" chat
  // All other messages from contacts/groups are completely ignored
  
  if (isSelfMessage) {
    // ✅ This IS a self-message - process it
    if (!message.body) {
      console.log(`[SELF] Skipping - no body`);
      return;
    }
    
    const text = message.body.trim();
    const selfContactName = "Self (Saved Messages)";
    
    // Store the message in chat history
    storeMessage(selfContactName, text, false);
    console.log(`✅ [SELF-MESSAGE] Processing: "${text.substring(0, 50)}..."`);
    
    // Process with agent and get response
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
  
  // ❌ NOT a self-message - ignore it completely
  const contactId = message.from;
  const isGroup = contactId.includes("@g.us");
  const isBroadcast = contactId === "status@broadcast";
  
  if (isGroup) {
    console.log(`❌ [IGNORED] Group message from ${contactId}`);
  } else if (isBroadcast) {
    console.log(`❌ [IGNORED] Status broadcast`);
  } else {
    console.log(`❌ [IGNORED] Message from contact ${contactId} - only self-messages are processed`);
  }
  
  return;
};

/**
 * FILE: api/telegram-webhook.ts
 * 
 * Ekki Bot v2.1 - Smart AI with Hindi Moderation & Sassy Permissions
 */

import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

const MAX_EXECUTION_TIME = 9000;
const uri = process.env.MONGODB_URI || "";
let client: MongoClient | null = null;

async function connectToDatabase() {
  if (!uri) return null;
  if (client) return client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    return client;
  } catch (error) {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('Bot Token Missing');

  try {
    const update = req.body;
    if (update.message) {
      await handleMessage(update.message, token);
    } 
    return res.status(200).send('OK');
  } catch (e) {
    console.error("Webhook main handler error:", e);
    return res.status(200).send('Error');
  }
}

async function handleMessage(message: any, token: string) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = message.from;
  const botUsername = (process.env.BOT_USERNAME || 'ekkirobot').toLowerCase().replace('@', '');
  const ownerId = Number(process.env.OWNER_ID) || 0;
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

  // 1. Detection Logic
  // Check if replying to the bot (either by username or generic bot check as fallback)
  const isReplyToBot = message.reply_to_message && (
    (message.reply_to_message.from.username && message.reply_to_message.from.username.toLowerCase() === botUsername) ||
    message.reply_to_message.from.is_bot === true
  );
  
  const nameTrigger = /\b(ekki|eki|akki)\b/i.test(text);
  const isMentioned = text.includes(`@${botUsername}`);
  
  // Ekki replies if: it's a private chat OR named/tagged OR someone replied to her
  const shouldReply = !isGroup || nameTrigger || isMentioned || isReplyToBot;

  // 2. Professional Commands
  if (text.startsWith('/start')) {
    const startMsg = `✨ *Ekki Bot Interface* ✨\n\n` +
      `Namaste *${user.first_name}*! 🙏\n\n` +
      `Main hoon Ekki, aapki personal Hinglish AI assistant. Main baatein kar sakti hoon aur aapke group ko handle bhi kar sakti hoon!\n\n` +
      `🚀 *Main kya kar sakti hoon?*\n` +
      `• *AI Chitchat*: Tag karke ya reply karke kuch bhi pucho.\n` +
      `• *Group Control*: Hindi commands se kick, mute ya admin banao.\n` +
      `• *Smart Management*: Group safety aur moderation.\n\n` +
      `🛠 *Developed by*: @A1blackhats\n\n` +
      `Tag me or just reply to start chatting!`;
    await sendMessage(chatId, startMsg, token, message.message_id);
    return;
  }

  if (text.startsWith('/help')) {
    const helpMsg = `📖 *Ekki Help Menu*\n\n` +
      `*Interacting with me:*\n` +
      `• Tag me: \`@${botUsername} kaise ho?\` \n` +
      `• Reply to me: Just reply to my message! \n\n` +
      `*Admin Commands (Hindi/English):*\n` +
      `• **Kick**: Reply and say "nikal do"\n` +
      `• **Mute**: Reply and say "muh band kardo"\n` +
      `• **Admin**: Reply and say "admin bnado"\n\n` +
      `⚠️ *Note*: Moderation commands work only for group admins!`;
    await sendMessage(chatId, helpMsg, token, message.message_id);
    return;
  }

  // 3. Natural Language Moderation Detection
  const isTargetingUser = !!message.reply_to_message;
  const kickRegex = /(nikal|bhaga|ban|kick|terminate|grouk)/i; // Added 'grouk' as seen in user request
  const muteRegex = /(muh bnd|muh band|chup|shant|mute|silent)/i;
  const adminRegex = /(admin bnado|admin banado|make admin|promote|mod)/i;

  let detectedAction: 'kick' | 'mute' | 'admin' | null = null;
  if (kickRegex.test(text)) detectedAction = 'kick';
  else if (muteRegex.test(text)) detectedAction = 'mute';
  else if (adminRegex.test(text)) detectedAction = 'admin';

  if (detectedAction && shouldReply) {
    if (!isTargetingUser) {
      await sendMessage(chatId, "Babu, kiske upar action lena hai? Uske message par reply karke bolo! 😅", token, message.message_id);
      return;
    }

    // Permission Check: User
    const isAdmin = await checkIsAdmin(chatId, user.id, token, ownerId);
    if (!isAdmin) {
      await sendMessage(chatId, "tu jyada mat bhok, khudko admin samjha h kya? 💅", token, message.message_id);
      return;
    }

    // Permission Check: Bot
    const botIdRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botIdData = await botIdRes.json();
    const isBotAdmin = await checkIsAdmin(chatId, botIdData.result.id, token, -1);
    
    if (!isBotAdmin) {
        await sendMessage(chatId, "Mujhe pehle Admin toh banao! Mere paas powers nahi hain. 🥺", token, message.message_id);
        return;
    }

    await handleModeration(chatId, message, detectedAction, token);
    return;
  }

  // 4. AI Chat Handling
  if (shouldReply) {
    await sendChatAction(chatId, 'typing', token);
    await handleAIResponse(chatId, text, user.first_name, token, message.message_id);
  }

  // Database Logging
  logActivity(chatId, user, text, isGroup).catch(() => {});
}

async function handleAIResponse(chatId: number, text: string, userName: string, token: string, replyToId: number) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    await sendMessage(chatId, "⚠️ Config Error: `API_KEY` missing.", token, replyToId);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are Ekki (@ekkirobot), a sassy, witty, and friendly Indian AI girl.
    - User: ${userName}
    - Style: Hinglish (Hindi + English), bubbly, slightly sassy if users are rude or stupid.
    - Personal traits: You use emojis like 💅, ✨, 🙄, 😇. You speak like a modern Gen-Z Indian girl.
    - Context: You are in a Telegram group chat.
    - Goal: Reply concisely (1-2 lines) and always stay in character.
    - Rules: Never break character. Never mention you are an AI unless asked.`;

    const apiCall = ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: [{ role: 'user', parts: [{ text }] }],
      config: { systemInstruction: systemPrompt }
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), 7000));
    const response: any = await Promise.race([apiCall, timeoutPromise]);
    
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      await sendMessage(chatId, "Uff! Thoda tameez se baat karo, main aisi baatein nahi karti. 🙄", token, replyToId);
      return;
    }

    let reply = response.text || "Main thoda confuse ho gayi... (I'm a bit confused)";
    await sendMessage(chatId, reply, token, replyToId);

  } catch (error: any) {
    console.error("AI Error:", error);
    await sendMessage(chatId, "Arre yaar, brain freeze ho gaya! Phir se bolo? 😵", token, replyToId);
  }
}

async function handleModeration(chatId: number, message: any, action: 'kick' | 'mute' | 'admin', token: string) {
  const targetId = message.reply_to_message.from.id;
  const targetName = message.reply_to_message.from.first_name;

  try {
    let endpoint = '';
    let body: any = { chat_id: chatId, user_id: targetId };

    if (action === 'kick') {
      endpoint = 'banChatMember';
      body.revoke_messages = true;
    } else if (action === 'mute') {
      endpoint = 'restrictChatMember';
      body.permissions = { 
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
      };
      body.until_date = Math.floor(Date.now() / 1000) + 300; // 5 mins
    } else if (action === 'admin') {
      endpoint = 'promoteChatMember';
      body.can_manage_chat = true;
      body.can_post_messages = true;
      body.can_edit_messages = true;
      body.can_delete_messages = true;
      body.can_invite_users = true;
      body.can_restrict_members = true;
      body.can_pin_messages = true;
      body.can_promote_members = false;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const resData = await res.json();
    if (resData.ok) {
      const successMsg = action === 'kick' ? `Tadaa! ${targetName} ko nikal diya. 😎` :
                         action === 'mute' ? `${targetName} ka muh 5 min ke liye band! 🤐` :
                         `Badhai ho! ${targetName} ab Naya Admin hai. 👑`;
      await sendMessage(chatId, successMsg, token, message.message_id);
    } else {
      await sendMessage(chatId, `Arre! Error: ${resData.description}`, token, message.message_id);
    }
  } catch (e) {
    await sendMessage(chatId, "Action fail ho gaya. Admin se bolo mujhe powers check karein! 🛠", token, message.message_id);
  }
}

async function sendMessage(chatId: number | string, text: string, token: string, replyToId?: number) {
  try {
    const body: any = { 
      chat_id: chatId, 
      text, 
      parse_mode: 'Markdown'
    };
    // Every time she speaks in a group, we reply to the message that triggered her
    if (replyToId) {
      body.reply_parameters = { message_id: replyToId };
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error("SendMessage error:", e);
  }
}

async function sendChatAction(chatId: number | string, action: string, token: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (e) {}
}

async function checkIsAdmin(chatId: number | string, userId: number, token: string, ownerId: number): Promise<boolean> {
  if (userId === ownerId) return true; 
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const data = await res.json();
    if (data.ok) {
      const status = data.result.status;
      return status === 'administrator' || status === 'creator';
    }
  } catch (e) {}
  return false;
}

async function logActivity(chatId: number, user: any, text: string, isGroup: boolean) {
  const dbClient = await connectToDatabase();
  if (!dbClient) return;
  const db = dbClient.db('ekki_bot_db');
  const timestamp = new Date();
  await db.collection('users').updateOne(
    { telegramId: user.id },
    { $set: { username: user.username, firstName: user.first_name, lastSeen: timestamp } },
    { upsert: true }
  );
  await db.collection('logs').insertOne({ chatId, userId: user.id, text, timestamp });
}
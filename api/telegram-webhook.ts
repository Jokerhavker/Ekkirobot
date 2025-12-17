/**
 * FILE: api/telegram-webhook.ts
 * 
 * Ekki Bot v2.0 - Sassy AI with Hindi Admin Command Support
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
    return res.status(200).send('Error');
  }
}

async function handleMessage(message: any, token: string) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = message.from;
  const botUsername = process.env.BOT_USERNAME || 'ekkirobot';
  const ownerId = Number(process.env.OWNER_ID) || 0;
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

  // Detection logic
  const isReplyToBot = message.reply_to_message && message.reply_to_message.from.username === botUsername;
  const nameTrigger = /\b(ekki|eki|akki)\b/i.test(text);
  const isMentioned = text.includes(`@${botUsername}`);
  const shouldReply = !isGroup || nameTrigger || isMentioned || isReplyToBot;

  // 1. Professional Commands
  if (text.startsWith('/start')) {
    const startMsg = `✨ *Ekki Bot Interface* ✨\n\n` +
      `Namaste *${user.first_name}*! 🙏\n\n` +
      `Main hoon Ekki, aapki friendly Hinglish AI. \n` +
      `Main groups manage kar sakti hoon aur baatein bhi! \n\n` +
      `🚀 *Features:* \n` +
      `• AI Chat (Hinglish/Hindi/English)\n` +
      `• Admin Commands (Hindi supported!)\n` +
      `• Smart Group Management\n\n` +
      `🛠 *Developer:* @A1blackhats\n` +
      `Tag me or reply to start chatting!`;
    await sendMessage(chatId, startMsg, token, message.message_id);
    return;
  }

  if (text.startsWith('/help')) {
    const helpMsg = `📖 *Ekki Command Guide* \n\n` +
      `*Chat Commands:*\n` +
      `• Mention me: \`Ekki, kaise ho?\` \n` +
      `• Reply to me: \`Aur batao\` \n\n` +
      `*Admin Commands (Hindi):*\n` +
      `• Kick: \`Ekki isko nikal do\` (Reply to user)\n` +
      `• Mute: \`Ekki iska muh band kardo\` (Reply to user)\n` +
      `• Admin: \`Ekki isko admin bnado\` (Reply to user)\n\n` +
      `*Rules:* Only Admins can order me around! 😎`;
    await sendMessage(chatId, helpMsg, token, message.message_id);
    return;
  }

  // 2. Mod Command Detection (Natural Language Hindi/English)
  const isTargetingUser = !!message.reply_to_message;
  const kickRegex = /(nikal|bhaga|ban|kick|terminate)/i;
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

    const isAdmin = await checkIsAdmin(chatId, user.id, token, ownerId);
    if (!isAdmin) {
      await sendMessage(chatId, "Tu jyada mat bhok, khudko admin samjha h kya? 💅", token, message.message_id);
      return;
    }

    await handleModeration(chatId, message, detectedAction, token);
    return;
  }

  // 3. AI Chat Handling
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
    const systemPrompt = `You are Ekki (@ekkirobot), a sassy and friendly Indian AI girl.
    - User: ${userName}
    - Style: Hinglish, bubbly, slightly sassy if users are rude.
    - Context: Telegram Chat.
    - Key Personality: You use emojis, speak like a Gen-Z Indian girl.
    - Task: Reply concisely (1-2 lines).`;

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
    await sendMessage(chatId, "Arre yaar, brain freeze ho gaya! Phir se bolo? 😵", token, replyToId);
  }
}

async function handleModeration(chatId: number, message: any, action: 'kick' | 'mute' | 'admin', token: string) {
  const targetId = message.reply_to_message.from.id;
  const targetName = message.reply_to_message.from.first_name;

  try {
    // Check Bot's own permissions first
    const botRes = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${(await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json()).result.id}`);
    const botData = await botRes.json();
    const botStatus = botData.result.status;

    if (botStatus !== 'administrator') {
      await sendMessage(chatId, "Mujhe pehle Admin toh banao! Mere paas powers nahi hain. 🥺", token, message.message_id);
      return;
    }

    let endpoint = '';
    let body: any = { chat_id: chatId, user_id: targetId };

    if (action === 'kick') {
      endpoint = 'banChatMember';
      body.revoke_messages = true;
    } else if (action === 'mute') {
      endpoint = 'restrictChatMember';
      body.permissions = { can_send_messages: false };
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
      await sendMessage(chatId, `Arre! Permission issue hai shayad. Check karo? (Error: ${resData.description})`, token, message.message_id);
    }
  } catch (e) {
    await sendMessage(chatId, "Action fail ho gaya. Admin se bolo mujhe full power dein! 🛠", token, message.message_id);
  }
}

async function sendMessage(chatId: number | string, text: string, token: string, replyToId?: number) {
  try {
    const body: any = { 
      chat_id: chatId, 
      text, 
      parse_mode: 'Markdown'
    };
    if (replyToId) {
      body.reply_parameters = { message_id: replyToId };
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {}
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
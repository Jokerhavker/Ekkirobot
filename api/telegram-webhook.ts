/**
 * FILE: api/telegram-webhook.ts
 * 
 * Vercel Serverless Function for Ekki Bot
 * Handles Webhooks, MongoDB Storage, and AI Responses.
 */

import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

// --- MongoDB Configuration ---
const uri = process.env.MONGODB_URI || "";
let client: MongoClient | null = null;

async function connectToDatabase() {
  if (!uri) {
    console.warn("MONGODB_URI is not defined. Database features will be disabled.");
    return null;
  }
  if (client) return client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    return client;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    return null;
  }
}

// --- Main Handler ---
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('Bot Token Missing');

  try {
    // In Vercel Node runtime, req.body is already parsed if valid JSON
    const update = req.body; 
    console.log("Received Update:", JSON.stringify(update, null, 2));
    
    // Check if it's a message
    if (update.message) {
      await handleMessage(update.message, token);
    } 
    // Handle Callback Queries (if any in future)
    else if (update.callback_query) {
      // Future implementation
    }

    return res.status(200).send('OK');
  } catch (e) {
    console.error("Webhook Error:", e);
    return res.status(500).send('Error');
  }
}

// --- Message Handler ---
async function handleMessage(message: any, token: string) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = message.from;
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
  const ownerId = Number(process.env.OWNER_ID) || 0;

  // 1. Database Operations (Store Everything)
  try {
    const dbClient = await connectToDatabase();
    const db = dbClient?.db('ekki_bot_db');
    
    if (db) {
      // Upsert User
      await db.collection('users').updateOne(
        { telegramId: user.id },
        { 
          $set: { 
            username: user.username, 
            firstName: user.first_name, 
            lastSeen: new Date() 
          },
          $setOnInsert: { isBlocked: false, role: 'user', joinedAt: new Date() }
        },
        { upsert: true }
      );

      // Upsert Group (if applicable)
      if (isGroup) {
        await db.collection('groups').updateOne(
          { groupId: chatId },
          { 
            $set: { title: message.chat.title, lastActive: new Date() },
            $setOnInsert: { isBlocked: false, joinedAt: new Date() }
          },
          { upsert: true }
        );
      }

      // Check Blacklist
      const userDoc = await db.collection('users').findOne({ telegramId: user.id });
      if (userDoc?.isBlocked) return; // Ignore blocked users

      if (isGroup) {
        const groupDoc = await db.collection('groups').findOne({ groupId: chatId });
        if (groupDoc?.isBlocked) return; // Ignore blocked groups
      }

      // Log User Message
      await db.collection('logs').insertOne({
        chatId,
        userId: user.id,
        text,
        role: 'user',
        timestamp: new Date()
      });
    }
  } catch (dbError) {
    console.error("Database Error (Non-fatal):", dbError);
  }

  // 2. Admin & Moderation Logic (Kick/Ban/Mute)
  const lowerText = text.toLowerCase();
  const modCommand = lowerText.match(/\b(kick|ban|mute)\b/);
  
  if (modCommand && (message.reply_to_message || message.entities)) {
    const isAdmin = await checkIsAdmin(chatId, user.id, token, ownerId);
    
    if (isAdmin) {
      let targetId = message.reply_to_message?.from?.id;
      let targetName = message.reply_to_message?.from?.first_name || "User";

      if (targetId) {
        const action = modCommand[0]; 
        let success = false;
        
        try {
          if (action === 'kick' || action === 'ban') {
             await  fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, user_id: targetId })
             });
             success = true;
          } else if (action === 'mute') {
             await  fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  chat_id: chatId, 
                  user_id: targetId,
                  permissions: { can_send_messages: false }
                })
             });
             success = true;
          }

          if (success) {
            await sendMessage(chatId, `Done! ${action}ed ${targetName} as requested. 😎`, token);
            return; 
          }
        } catch (err) {
          await sendMessage(chatId, `I tried to ${action} them, but I don't have enough permissions! Make me admin first. 🥺`, token);
          return;
        }
      }
    }
  }

  // 3. Bot Commands (/start, /help)
  if (text.startsWith('/start')) {
    const intro = `Namaste! 🙏\nI am Ekki, your AI friend and group manager.\n\nI can talk in Hinglish and help manage your group.\nMade with ❤️ by @A1blackhats.`;
    await sendMessage(chatId, intro, token);
    return;
  }
  
  if (text.startsWith('/help')) {
    const help = `**How to use Ekki:**\n\n🗣️ **Chat:** Tag me @ekkirobot or say 'Ekki'/'Akki' to talk.\n🛠️ **Admin:** Admins can reply to a user with "Kick", "Ban", or "Mute" and I will handle it!\n\nI speak Hinglish mostly!`;
    await sendMessage(chatId, help, token);
    return;
  }

  // 4. AI Chat Logic
  const isMentioned = 
    text.includes(`@${process.env.BOT_USERNAME || 'ekkirobot'}`) || 
    lowerText.includes('ekki') || 
    lowerText.includes('eki') || 
    lowerText.includes('akki') ||
    (message.reply_to_message && message.reply_to_message.from.username === (process.env.BOT_USERNAME || 'ekkirobot'));

  // Only reply in groups if mentioned, always reply in private
  if (isGroup && !isMentioned) return;

  const apiKey = process.env.API_KEY || '';
  if (!apiKey) {
    console.error("API_KEY is missing");
    await sendMessage(chatId, "My AI brain is missing an API Key! Please tell my owner.", token);
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const systemPrompt = `You are Ekki (username @ekkirobot), a polite and friendly girl AI. 
    - You were made by @A1blackhats.
    - Speak mainly in Hinglish (Hindi + English).
    - Be polite, bubbly, and helpful.
    - User name is ${user.first_name}.
    - Keep replies concise for Telegram.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        systemInstruction: systemPrompt
      }
    });

    const reply = response.text; 
    
    // Log AI Response to DB
    const dbClient = await connectToDatabase();
    const db = dbClient?.db('ekki_bot_db');
    if (db) {
       await db.collection('logs').insertOne({
        chatId,
        userId: 0, 
        text: reply || 'Error in response',
        role: 'model',
        timestamp: new Date()
      });
    }

    if (reply) {
      await sendMessage(chatId, reply, token);
    }
  } catch (error) {
    console.error('Gemini Error', error);
  }
}

// --- Helpers ---

async function sendMessage(chatId: number | string, text: string, token: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

async function checkIsAdmin(chatId: number | string, userId: number, token: string, ownerId: number): Promise<boolean> {
  if (userId === ownerId) return true; // Bot Owner is always admin

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const data = await res.json();
    if (data.ok) {
      const status = data.result.status;
      return status === 'administrator' || status === 'creator';
    }
  } catch (e) {
    console.error("Admin check failed", e);
  }
  return false;
}
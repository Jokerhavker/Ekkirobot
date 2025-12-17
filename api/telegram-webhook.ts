/**
 * FILE: api/telegram-webhook.ts
 * 
 * Vercel Serverless Function for Ekki Bot
 * Handles Webhooks, MongoDB Storage, and AI Responses.
 */

import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

// --- Configuration ---
const MAX_EXECUTION_TIME = 9000; // 9 seconds

// --- MongoDB Configuration ---
const uri = process.env.MONGODB_URI || "";
let client: MongoClient | null = null;

async function connectToDatabase() {
  if (!uri) return null; // Fail silently if no URI
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
  // Fast fail for non-POST
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('Bot Token Missing');

  try {
    const update = req.body;
    
    if (update.message) {
      // Note: In Vercel, we must await the work before returning or the function freezes.
      await handleMessage(update.message, token);
    } 

    return res.status(200).send('OK');
  } catch (e) {
    console.error("Webhook Error:", e);
    // Always return 200 to prevent Telegram from retrying endlessly
    return res.status(200).send('Error');
  }
}

// --- Message Handler ---
async function handleMessage(message: any, token: string) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = message.from;
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
  const ownerId = Number(process.env.OWNER_ID) || 0;
  
  // triggers
  const botUsername = process.env.BOT_USERNAME || 'ekkirobot';
  const isMentioned = 
    text.includes(`@${botUsername}`) || 
    (message.reply_to_message && message.reply_to_message.from.username === botUsername);
  
  // Regex for name triggers (case insensitive)
  const nameTrigger = /\b(ekki|eki|akki)\b/i.test(text);

  const shouldReply = !isGroup || isMentioned || nameTrigger;
  const isCommand = text.startsWith('/');

  // OPTIMIZATION: Only connect to DB if we really need to (Command, Mention, Private)
  const shouldLog = shouldReply || isCommand || !isGroup;

  // 1. Send Typing Indicator immediately if we plan to reply
  if (shouldReply && !isCommand) {
     sendChatAction(chatId, 'typing', token).catch(e => console.error("Typing action failed", e));
  }

  // 2. Prepare Parallel Tasks
  const tasks: Promise<any>[] = [];

  // TASK A: Database Logging (Background)
  if (shouldLog) {
    tasks.push((async () => {
      try {
        const dbClient = await connectToDatabase();
        if (!dbClient) return;
        const db = dbClient.db('ekki_bot_db');
        
        const timestamp = new Date();

        // Parallel DB writes
        await Promise.all([
            // Upsert User
            db.collection('users').updateOne(
                { telegramId: user.id },
                { 
                    $set: { username: user.username, firstName: user.first_name, lastSeen: timestamp },
                    $setOnInsert: { isBlocked: false, role: 'user', joinedAt: timestamp }
                },
                { upsert: true }
            ),
            // Upsert Group
            isGroup ? db.collection('groups').updateOne(
                { groupId: chatId },
                { 
                    $set: { title: message.chat.title, lastActive: timestamp },
                    $setOnInsert: { isBlocked: false, joinedAt: timestamp }
                },
                { upsert: true }
            ) : Promise.resolve(),
            // Log Message
            db.collection('logs').insertOne({
                chatId,
                userId: user.id,
                text,
                role: 'user',
                timestamp
            })
        ]);
        
        // Check blocklist
        const userDoc = await db.collection('users').findOne({ telegramId: user.id });
        if (userDoc?.isBlocked) throw new Error("BLOCKED_USER");
      } catch (e: any) {
        if (e.message === "BLOCKED_USER") throw e;
        console.error("DB Task Error:", e);
      }
    })());
  }

  // TASK B: Core Logic (Admin or AI)
  tasks.push((async () => {
    // Admin / Mod Commands
    const lowerText = text.toLowerCase();
    const modMatch = lowerText.match(/\b(kick|ban|mute)\b/);
    
    if (modMatch && (message.reply_to_message || message.entities)) {
       const isAdmin = await checkIsAdmin(chatId, user.id, token, ownerId);
       if (isAdmin) {
         await handleModeration(chatId, message, modMatch[0], token);
         return; // Don't do AI if it was a command
       }
    }

    if (text.startsWith('/start')) {
        await sendMessage(chatId, `Namaste! 🙏\nI am Ekki. Tag me to talk!`, token);
        return;
    }
    
    if (text.startsWith('/help')) {
        await sendMessage(chatId, `**Help:**\n• Chat: @${botUsername} [msg]\n• Admin: Reply with Kick/Ban/Mute`, token);
        return;
    }

    // AI Response
    if (shouldReply) {
       await handleAIResponse(chatId, text, user.first_name, token);
    }
  })());

  // Execute everything
  try {
    await Promise.all(tasks);
  } catch (e: any) {
    if (e.message === "BLOCKED_USER") {
      console.log(`Blocked user ${user.id} attempted to interact.`);
    } else {
      console.error("Handler execution error:", e);
    }
  }
}

// --- Sub-Handlers ---

async function handleAIResponse(chatId: number, text: string, userName: string, token: string) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // This message helps user know they need to check Vercel Env Vars and redeploy
    await sendMessage(chatId, "⚠️ Config Error: `API_KEY` is missing in Vercel. Please add it and Redeploy.", token);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are Ekki (@ekkirobot), a friendly Indian AI girl.
    - User: ${userName}
    - Style: Hinglish (Hindi+English mix), casual, bubbly, using emojis.
    - Length: Keep it short (1-2 sentences) for chat.
    - Context: You are in a Telegram chat.
    `;

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("AI_TIMEOUT")), MAX_EXECUTION_TIME - 2000)
    );

    const apiCall = ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: [{ role: 'user', parts: [{ text }] }],
        config: { systemInstruction: systemPrompt }
    });

    // Race against timeout
    const response: any = await Promise.race([apiCall, timeoutPromise]);
    
    // Explicitly check for Safety Block or other Finish Reasons
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION' || candidate?.finishReason === 'OTHER') {
       await sendMessage(chatId, "Sorry, I can't talk about that. Let's keep it clean! 😇", token);
       return;
    }

    // Safely access text. .text getter can be undefined but doesn't throw usually.
    // However, if response structure is malformed, it might.
    let reply = "";
    try {
        if (response.text) {
             reply = response.text;
        }
    } catch(err) {
        console.error("Text extraction failed:", err);
    }

    if (reply) {
      await sendMessage(chatId, reply, token);
      logBotReply(chatId, reply).catch(console.error);
    } else {
      // Fallback if no text but not caught as safety
      await sendMessage(chatId, "I didn't get that. Could you say it differently?", token);
    }

  } catch (error: any) {
    console.error('AI Error:', error);
    if (error.message === "AI_TIMEOUT") {
        await sendMessage(chatId, "Sochne mein time lag raha hai... (Thinking took too long!) 😅", token);
    } else {
        // Detailed error for debugging
        const msg = error.message || 'Unknown';
        if (msg.includes('429')) {
             await sendMessage(chatId, "Too many messages! Let me breathe. 🥵 (Rate Limit)", token);
        } else if (msg.includes('500')) {
             await sendMessage(chatId, "My brain is having a hiccup. Try again later. 😵", token);
        } else {
             await sendMessage(chatId, `Kuch gadbad ho gayi... (Error: ${msg})`, token);
        }
    }
  }
}

async function handleModeration(chatId: number, message: any, action: string, token: string) {
    const targetId = message.reply_to_message?.from?.id;
    if (!targetId) return;

    try {
        let endpoint = 'banChatMember'; 
        let body: any = { chat_id: chatId, user_id: targetId };
        
        if (action === 'mute') {
            endpoint = 'restrictChatMember';
            body.permissions = { can_send_messages: false };
        } 

        const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            await sendMessage(chatId, `Done! ${action}ed user.`, token);
        } else {
            throw new Error("Telegram API Failed");
        }
    } catch (e) {
        await sendMessage(chatId, `Failed to ${action}. Give me Admin permissions!`, token);
    }
}

// --- Helpers ---

async function sendMessage(chatId: number | string, text: string, token: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error("SendMessage Error", e);
  }
}

async function sendChatAction(chatId: number | string, action: string, token: string) {
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action })
        });
    } catch (e) {
        console.error("ChatAction Error", e);
    }
}

async function logBotReply(chatId: number, text: string) {
    const client = await connectToDatabase();
    if (client) {
        await client.db('ekki_bot_db').collection('logs').insertOne({
            chatId,
            userId: 0,
            text,
            role: 'model',
            timestamp: new Date()
        });
    }
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
  } catch (e) {
    console.error("Admin check failed", e);
  }
  return false;
}
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth Check
  const adminKey = req.headers['x-admin-key'];
  const envOwnerId = process.env.OWNER_ID;
  const providedKey = Array.isArray(adminKey) ? adminKey[0] : adminKey;

  if (!providedKey || providedKey !== envOwnerId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!apiKey) {
    console.error("API_KEY missing in server environment");
    return res.status(500).json({ error: 'Server Config Error: API_KEY is missing.' });
  }

  try {
    const { message, history } = req.body;
    
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `
    You are Ekki (username @ekkirobot), a polite and friendly girl AI assistant for a Telegram group.
    - You were made by @A1blackhats.
    - Your primary language style is Hinglish (a mix of Hindi and English).
    - Tone: Casual, polite, slightly playful, like a helpful friend.
    - Context: This is a Live Chat Demo in the Admin Panel.
    - Keep responses concise.
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
        temperature: 0.9,
        maxOutputTokens: 200,
      },
      history: history || []
    });

    const result = await chat.sendMessage({ message });
    return res.status(200).json({ text: result.text });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message || 'AI Generation Failed' });
  }
}
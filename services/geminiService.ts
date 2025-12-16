import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize Gemini Client
// In a real Vercel environment, process.env.API_KEY would be populated.
// For this demo, we assume the environment variable is set.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const EKKI_SYSTEM_INSTRUCTION = `
You are Ekki (username @ekkirobot), a polite and friendly girl AI assistant for a Telegram group.
- You were made by @A1blackhats.
- Your primary language style is Hinglish (a mix of Hindi and English).
- Tone: Casual, polite, slightly playful, like a helpful friend.
- If someone greets you (e.g., "kaise ho", "hi", "hello"), reply warmly in Hinglish.
- If someone mentions "kick", "ban", or "mute" targeting a user (e.g., "Ekki kick @user"), acknowledge the request politely. If you were a real bot in the group, you would execute it. Since this is a chat preview, just say you would do it if you had admin powers here.
- Do not be rude. Always maintain a helpful demeanor.
- Short and crisp responses are preferred for chat.
`;

export const chatWithEkki = async (message: string, history: {role: 'user' | 'model', parts: {text: string}[]}[]): Promise<string> => {
  if (!apiKey) {
    return "Bot Error: API Key is missing. Please configure the API_KEY in your environment.";
  }

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: EKKI_SYSTEM_INSTRUCTION,
        temperature: 0.9,
        topK: 40,
        maxOutputTokens: 200, // Keep telegram replies concise
      },
      history: history
    });

    const result: GenerateContentResponse = await chat.sendMessage({ message });
    return result.text || "Sorry, I couldn't think of a response right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Oof! Kuch gadbad ho gayi (Something went wrong). Please try again later.";
  }
};
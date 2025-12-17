
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

  const groqApiKey = process.env.GROQ_API_KEY;
  const adminKey = req.headers['x-admin-key'];
  const envOwnerId = process.env.OWNER_ID;
  const providedKey = Array.isArray(adminKey) ? adminKey[0] : adminKey;

  if (!providedKey || providedKey !== envOwnerId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!groqApiKey) {
    return res.status(500).json({ error: 'Server Config Error: GROQ_API_KEY is missing.' });
  }

  try {
    const { message, history } = req.body;

    // Convert history format if necessary (Telegram uses role: model, Groq uses role: assistant)
    const messages = [
      {
        role: "system",
        content: "You are Ekki (@ekkirobot), a sassy, smart, and friendly Indian girl AI. You speak Hinglish (mix of Hindi/English). Be bubbly, use emojis, and avoid being overly formal. You are not a regular AI; you are Ekki."
      },
      ...(history || []).map((h: any) => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: typeof h.parts?.[0]?.text === 'string' ? h.parts[0].text : h.text
      })),
      { role: "user", content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.9,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Groq API Error');
    }

    return res.status(200).json({ text: data.choices[0].message.content });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message || 'AI Generation Failed' });
  }
}

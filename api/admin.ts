import { MongoClient } from "mongodb";

// Reuse connection logic for serverless environment
const uri = process.env.MONGODB_URI || "";
let client: MongoClient | null = null;

async function connectToDatabase() {
  if (!uri) throw new Error("MONGODB_URI is not defined");
  if (client) return client;
  client = new MongoClient(uri);
  await client.connect();
  return client;
}

export default async function handler(req: any, res: any) {
  // CORS Headers for client-side access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication
  // In Node.js runtime, headers is a plain object. Keys are lowercased.
  const adminKey = req.headers['x-admin-key'];
  const envOwnerId = process.env.OWNER_ID;
  
  // Handle case where header might be an array
  const providedKey = Array.isArray(adminKey) ? adminKey[0] : adminKey;

  if (!providedKey || providedKey !== envOwnerId) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Owner ID' });
  }

  try {
    // Vercel parses JSON body automatically for Node functions
    const { action, payload } = req.body;
    let result;

    switch (action) {
      case 'stats': {
        const dbClient = await connectToDatabase();
        const db = dbClient.db('ekki_bot_db');
        
        const totalUsers = await db.collection('users').countDocuments();
        const activeGroups = await db.collection('groups').countDocuments({ isBlocked: { $ne: true } });
        const blockedUsers = await db.collection('users').countDocuments({ isBlocked: true });
        const totalLogs = await db.collection('logs').countDocuments();
        result = { totalUsers, activeGroups, blockedUsers, totalLogs };
        break;
      }

      case 'get_users': {
        const dbClient = await connectToDatabase();
        const db = dbClient.db('ekki_bot_db');

        const users = await db.collection('users')
          .find({})
          .sort({ lastSeen: -1 })
          .limit(50)
          .toArray();
        result = users.map(u => ({
          id: u.telegramId,
          username: u.username || 'Unknown',
          firstName: u.firstName || 'User',
          status: u.isBlocked ? 'blocked' : 'active',
          joinedAt: u.lastSeen ? new Date(u.lastSeen).toISOString().split('T')[0] : 'N/A'
        }));
        break;
      }

      case 'toggle_block': {
        const dbClient = await connectToDatabase();
        const db = dbClient.db('ekki_bot_db');

        const { userId, status } = payload;
        const isBlocked = status === 'blocked';
        await db.collection('users').updateOne(
          { telegramId: userId },
          { $set: { isBlocked } }
        );
        result = { success: true };
        break;
      }

      case 'broadcast': {
        const dbClient = await connectToDatabase();
        const db = dbClient.db('ekki_bot_db');

        const { message, target } = payload;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        
        let query = {};
        let collectionName = 'users';

        if (target === 'groups') {
          collectionName = 'groups';
          query = { isBlocked: { $ne: true } };
        } else if (target === 'users') {
          query = { isBlocked: { $ne: true } };
        }
        
        const targets = await db.collection(collectionName).find(query).limit(500).toArray();
        let sentCount = 0;

        for (const t of targets) {
           const chatId = (t as any).telegramId || (t as any).groupId;
           if (!chatId) continue;
           
           try {
             await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
             });
             sentCount++;
           } catch (e) {
             console.error(`Failed to send to ${chatId}`);
           }
        }
        result = { success: true, sent: sentCount };
        break;
      }

      case 'set_webhook': {
        const { domain } = payload;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!token) {
           throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");
        }

        const cleanDomain = domain.replace(/\/$/, "");
        const webhookUrl = `${cleanDomain}/api/telegram-webhook`;
        
        console.log(`Setting webhook to: ${webhookUrl}`);

        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
        const data = await response.json();
        
        result = data;
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid Action' });
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Admin API Error", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
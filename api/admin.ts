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

export default async function handler(request: Request) {
  // CORS Headers for client-side access
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers });
  }

  // Authentication
  const adminKey = request.headers.get('x-admin-key');
  const envOwnerId = process.env.OWNER_ID;
  
  if (!adminKey || adminKey !== envOwnerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Owner ID' }), { status: 401, headers });
  }

  try {
    const { action, payload } = await request.json();
    let result;

    // We only connect to DB inside the cases that need it. 
    // This allows 'set_webhook' to work even if DB is not configured.

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
        // No DB connection required here
        const { domain } = payload;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!token) {
           throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");
        }

        // Remove trailing slash if present
        const cleanDomain = domain.replace(/\/$/, "");
        const webhookUrl = `${cleanDomain}/api/telegram-webhook`;
        
        console.log(`Setting webhook to: ${webhookUrl}`);

        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
        const data = await response.json();
        
        result = data;
        break;
      }

      default:
        return new Response('Invalid Action', { status: 400, headers });
    }

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (error: any) {
    console.error("Admin API Error", error);
    // Return the actual error message to the frontend for better debugging
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers });
  }
}
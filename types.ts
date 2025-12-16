export interface User {
  id: number;
  username: string;
  firstName: string;
  status: 'active' | 'blocked';
  joinedAt: string;
}

export interface Group {
  id: number;
  title: string;
  memberCount: number;
  status: 'active' | 'blocked';
  joinedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum BotCommand {
  START = '/start',
  HELP = '/help',
  KICK = 'kick',
  MUTE = 'mute',
  BAN = 'ban'
}

export interface BroadcastStats {
  totalSent: number;
  success: number;
  failed: number;
}

// MongoDB Schemas
export interface MongoUser {
  telegramId: number;
  username?: string;
  firstName: string;
  isBlocked: boolean;
  lastSeen: Date;
  role?: 'user' | 'admin' | 'owner';
}

export interface MongoGroup {
  groupId: number;
  title: string;
  isBlocked: boolean;
  lastActive: Date;
}

export interface MongoLog {
  chatId: number;
  userId: number;
  text: string;
  role: 'user' | 'model';
  timestamp: Date;
}
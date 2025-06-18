export enum MessageCategory {
  SYSTEM = 'SYSTEM',
  UPDATE = 'UPDATE',
  PROMOTION = 'PROMOTION',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export enum MessageType {
  PERSONAL = 'PERSONAL',
  GLOBAL = 'GLOBAL',
}

export interface Message {
  id: string;
  category: MessageCategory;
  title: string;
  content: string;
  createdAt: number;
  expiresAt?: number;
  type: MessageType;
  userId?: string; // 对于个人消息是必需的，全局消息可选
  isRead?: boolean; // 只在前端展示时使用，存储逻辑不同
}

export interface MessageReadStatus {
  messageId: string;
  userId: string;
  isRead: boolean;
}

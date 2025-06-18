import { Injectable } from '@nestjs/common';
import { DBService, db_tables, PGKVDatabase } from '../../common/db.service';
import {
  MessageCategory,
  MessageType,
  Message,
  MessageReadStatus,
} from './interfaces/system-message.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SystemMessageService {
  private message_db: PGKVDatabase;
  private read_status_db: PGKVDatabase;

  constructor(private readonly dbService: DBService) {
    this.message_db = this.dbService.getDBInstance(db_tables.messages);
    this.read_status_db = this.dbService.getDBInstance(
      db_tables.message_read_status,
    );
  }

  async createMessage(
    userId: string,
    category: MessageCategory,
    title: string,
    content: string,
    expiresAt?: number,
  ): Promise<Message> {
    const id = `personal_${category}_${uuidv4()}`;
    const message: Message = {
      id,
      userId,
      category,
      title,
      content,
      createdAt: Date.now(),
      expiresAt,
      type: MessageType.PERSONAL,
    };

    await this.message_db.put(id, message);

    // 个人消息默认未读，存储在消息中
    await this.setMessageReadStatus(id, userId, false);

    return message;
  }

  async createBroadcastMessage(
    userIds: string[],
    category: MessageCategory,
    title: string,
    content: string,
    expiresAt?: number,
  ): Promise<Message[]> {
    const timestamp = Date.now();
    const messages: Message[] = [];

    for (const userId of userIds) {
      const id = `personal_${category}_${uuidv4()}`;
      const message: Message = {
        id,
        userId,
        category,
        title,
        content,
        createdAt: timestamp,
        expiresAt,
        type: MessageType.PERSONAL,
      };
      messages.push(message);

      // 设置默认未读状态
      await this.setMessageReadStatus(id, userId, false);
    }

    // 批量存储消息
    const putPromises = messages.map((message) =>
      this.message_db.put(message.id, message),
    );
    await Promise.all(putPromises);

    return messages;
  }

  async createGlobalMessage(
    category: MessageCategory,
    title: string,
    content: string,
    expiresAt?: number,
  ): Promise<Message> {
    const id = `global_${category}_${uuidv4()}`;
    const message: Message = {
      id,
      category,
      title,
      content,
      createdAt: Date.now(),
      expiresAt,
      type: MessageType.GLOBAL,
    };

    await this.message_db.put(id, message);
    return message;
  }

  // 统一设置消息已读状态的方法
  async setMessageReadStatus(
    messageId: string,
    userId: string,
    isRead: boolean,
  ): Promise<boolean> {
    const statusId = `${messageId}_${userId}`;
    const readStatus: MessageReadStatus = {
      messageId,
      userId,
      isRead,
    };

    await this.read_status_db.put(statusId, readStatus);
    return true;
  }

  // 获取消息已读状态
  async getMessageReadStatus(
    messageId: string,
    userId: string,
  ): Promise<boolean> {
    const statusId = `${messageId}_${userId}`;
    const readStatus = await this.read_status_db.get(statusId);
    return readStatus ? readStatus.isRead : false;
  }

  // 获取单条消息
  async getMessageById(messageId: string): Promise<Message | null> {
    return await this.message_db.get(messageId);
  }

  // 获取个人消息
  async getUserMessages(userId: string): Promise<Message[]> {
    const allMessages = await this.message_db.getAll();
    const now = Date.now();

    // 过滤出个人消息并添加已读状态
    const personalMessages = Array.from(allMessages.values())
      .filter(
        (msg: Message) =>
          msg.type === MessageType.PERSONAL && msg.userId === userId,
      )
      .filter((msg: Message) => !msg.expiresAt || msg.expiresAt > now);

    // 获取已读状态
    const messagesWithStatus = await Promise.all(
      personalMessages.map(async (msg) => {
        const isRead = await this.getMessageReadStatus(msg.id, userId);
        return { ...msg, isRead };
      }),
    );

    return messagesWithStatus.sort((a, b) => b.createdAt - a.createdAt);
  }

  // 获取全局消息
  async getGlobalMessages(): Promise<Message[]> {
    const allMessages = await this.message_db.getAll();
    const now = Date.now();

    const globalMessages = Array.from(allMessages.values())
      .filter((msg: Message) => msg.type === MessageType.GLOBAL)
      .filter((msg: Message) => !msg.expiresAt || msg.expiresAt > now)
      .sort((a: Message, b: Message) => b.createdAt - a.createdAt);

    return globalMessages;
  }

  // 获取用户的全局消息（包含已读状态）
  async getUserGlobalMessages(userId: string): Promise<Message[]> {
    const globalMessages = await this.getGlobalMessages();

    // 添加已读状态
    const messagesWithStatus = await Promise.all(
      globalMessages.map(async (msg) => {
        const isRead = await this.getMessageReadStatus(msg.id, userId);
        return { ...msg, isRead };
      }),
    );

    return messagesWithStatus;
  }

  // 获取所有消息（个人+全局）
  async getAllUserMessages(userId: string): Promise<Message[]> {
    const personalMessages = await this.getUserMessages(userId);
    const globalMessages = await this.getUserGlobalMessages(userId);

    return [...personalMessages, ...globalMessages].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  // 获取已读用户消息
  async getReadUserMessages(userId: string): Promise<Message[]> {
    const allMessages = await this.getAllUserMessages(userId);
    return allMessages.filter((msg) => msg.isRead);
  }

  // 获取未读用户消息
  async getUnreadUserMessages(userId: string): Promise<Message[]> {
    const allMessages = await this.getAllUserMessages(userId);
    return allMessages.filter((msg) => !msg.isRead);
  }

  // 按分类获取消息
  async getUserMessagesByCategory(
    userId: string,
    category: MessageCategory,
  ): Promise<Message[]> {
    const allMessages = await this.getAllUserMessages(userId);
    return allMessages.filter((msg) => msg.category === category);
  }

  // 标记消息为已读
  async markMessageAsRead(messageId: string, userId: string): Promise<boolean> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    return this.setMessageReadStatus(messageId, userId, true);
  }

  // 标记所有个人消息为已读
  async markAllUserMessagesAsRead(userId: string): Promise<boolean> {
    const userMessages = await this.getUserMessages(userId);
    const markPromises = userMessages.map(async (msg) => {
      return this.setMessageReadStatus(msg.id, userId, true);
    });

    await Promise.all(markPromises);
    return true;
  }

  // 标记所有全局消息为已读
  async markAllGlobalMessagesAsRead(userId: string): Promise<boolean> {
    const globalMessages = await this.getGlobalMessages();

    const markPromises = globalMessages.map(async (msg) => {
      return this.setMessageReadStatus(msg.id, userId, true);
    });

    await Promise.all(markPromises);
    return true;
  }

  // 标记所有消息为已读
  async markAllMessagesAsRead(userId: string): Promise<boolean> {
    await this.markAllUserMessagesAsRead(userId);
    await this.markAllGlobalMessagesAsRead(userId);
    return true;
  }

  // 获取未读消息数量
  async getUnreadMessageCount(userId: string): Promise<number> {
    const unreadMessages = await this.getUnreadUserMessages(userId);
    return unreadMessages.length;
  }

  // 删除消息
  async deleteMessage(messageId: string): Promise<boolean> {
    return await this.message_db.delete(messageId);
  }

  // 删除过期的消息
  async deleteExpiredMessages(): Promise<number> {
    const allMessages = await this.message_db.getAll();
    const now = Date.now();

    const expiredMessages = Array.from(allMessages.values()).filter(
      (msg: Message) => msg.expiresAt && msg.expiresAt < now,
    );

    const deletePromises = expiredMessages.map(
      async (msg: Message) => await this.message_db.delete(msg.id),
    );

    await Promise.all(deletePromises);
    return expiredMessages.length;
  }

  // 删除过期的个人消息
  async deleteExpiredPersonalMessages(): Promise<number> {
    const allMessages = await this.message_db.getAll();
    const now = Date.now();

    const expiredMessages = Array.from(allMessages.values()).filter(
      (msg: Message) =>
        msg.type === MessageType.PERSONAL &&
        msg.expiresAt &&
        msg.expiresAt < now,
    );

    const deletePromises = expiredMessages.map(
      async (msg: Message) => await this.message_db.delete(msg.id),
    );

    await Promise.all(deletePromises);
    return expiredMessages.length;
  }

  // 删除过期的全局消息
  async deleteExpiredGlobalMessages(): Promise<number> {
    const allMessages = await this.message_db.getAll();
    const now = Date.now();

    const expiredMessages = Array.from(allMessages.values()).filter(
      (msg: Message) =>
        msg.type === MessageType.GLOBAL && msg.expiresAt && msg.expiresAt < now,
    );

    const deletePromises = expiredMessages.map(
      async (msg: Message) => await this.message_db.delete(msg.id),
    );

    await Promise.all(deletePromises);
    return expiredMessages.length;
  }

  // 根据消息类型创建消息
  async createMessageByType(
    userId: string,
    isAdmin: boolean,
    title: string,
    content: string,
    category: MessageCategory,
    type: MessageType = MessageType.PERSONAL,
    recipients?: string[],
    expiresAt?: number,
  ): Promise<Message> {
    // 创建全局消息需要管理员权限
    if (type === MessageType.GLOBAL) {
      if (!isAdmin) {
        throw new Error('Unauthorized. Only admins can send global messages.');
      }
      const globalMessage = await this.createGlobalMessage(
        category,
        title,
        content,
        expiresAt,
      );
      // For global messages created by a user, fetch their read status
      const isRead = await this.getMessageReadStatus(globalMessage.id, userId);
      return { ...globalMessage, isRead };
    }
    // 创建广播消息需要管理员权限
    else if (recipients && recipients.length > 0) {
      if (!isAdmin) {
        throw new Error(
          'Unauthorized. Only admins can send broadcast messages.',
        );
      }
      const messages = await this.createBroadcastMessage(
        recipients,
        category,
        title,
        content,
        expiresAt,
      );
      return messages[0]; // 返回第一条消息作为示例
    }
    // 创建个人消息
    else {
      return this.createMessage(userId, category, title, content, expiresAt);
    }
  }

  // 智能标记消息为已读
  async smartMarkAsRead(
    userId: string,
    messageId?: string,
    all: boolean = false,
    type?: MessageType,
  ): Promise<boolean> {
    if (all) {
      return this.markAllMessagesAsRead(userId);
    } else if (messageId) {
      return this.markMessageAsRead(messageId, userId);
    } else if (type === MessageType.GLOBAL) {
      return this.markAllGlobalMessagesAsRead(userId);
    } else if (type === MessageType.PERSONAL) {
      return this.markAllUserMessagesAsRead(userId);
    }

    return false;
  }

  // 带权限检查的消息删除
  async deleteMessageWithAuth(
    userId: string,
    isAdmin: boolean,
    messageId: string,
  ): Promise<boolean> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    // 检查权限
    if (message.type === MessageType.GLOBAL && !isAdmin) {
      throw new Error('Unauthorized. Only admins can delete global messages.');
    }

    if (message.type === MessageType.PERSONAL && message.userId !== userId) {
      throw new Error('Unauthorized. You can only delete your own messages.');
    }

    return this.deleteMessage(messageId);
  }

  // 清理过期消息（带类型过滤）
  async cleanupExpiredMessagesByType(
    isAdmin: boolean,
    type?: MessageType,
  ): Promise<number> {
    if (!isAdmin) {
      throw new Error(
        'Unauthorized. Only admins can cleanup expired messages.',
      );
    }

    if (type === MessageType.PERSONAL) {
      return this.deleteExpiredPersonalMessages();
    } else if (type === MessageType.GLOBAL) {
      return this.deleteExpiredGlobalMessages();
    } else {
      // 清理所有类型的过期消息
      return this.deleteExpiredMessages();
    }
  }

  // 根据过滤条件获取消息
  async getFilteredMessages(
    userId: string,
    filter: 'all' | 'unread' | 'read' = 'all',
    category?: MessageCategory,
    type?: MessageType,
  ): Promise<Message[]> {
    if (filter === 'unread') {
      return this.getUnreadUserMessages(userId);
    } else if (filter === 'read') {
      return this.getReadUserMessages(userId);
    } else if (category) {
      return this.getUserMessagesByCategory(userId, category);
    } else {
      return this.getAllUserMessages(userId);
    }
  }
}

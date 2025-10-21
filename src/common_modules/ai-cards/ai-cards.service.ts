import { Injectable } from '@nestjs/common';
import { DBService, PGKVDatabase, db_tables } from '../../common/db.service';
import { CryptoHelper, GeminiHelper } from '../../helpers/sdk';
import {
  StudyCard,
  CardGenerationRequest,
  CardGenerationResult,
  GeneratedCard,
  VocabularyType,
  AIGenerationConfig,
} from './interfaces/ai-cards.interface';

@Injectable()
export class AiCardsService {
  private processingQueue: Promise<any> = Promise.resolve();
  private cards_db: PGKVDatabase;
  private user_cards_db: PGKVDatabase;

  // 默认配置
  private readonly defaultConfig: AIGenerationConfig = {
    maxWordsPerBatch: 5,
    systemPrompt: `You are an English learning assistant. Generate 3 creative sentences for each word:
    1. mixed_chinese: A sentence mixing English and Chinese
    2. english_only: A complete English sentence
    3. fill_in_blanks: An English sentence with the target word replaced by ____

    Return the result as a JSON array of objects with properties: used_words, mixed_chinese, english_only, fill_in_blanks.`,
  };

  constructor(private readonly dbService: DBService) {
    this.cards_db = this.dbService.getDBInstance(db_tables.cards_db);
    this.user_cards_db = this.dbService.getDBInstance(db_tables.user_db);
  }

  /**
   * 生成学习卡片的哈希值
   */
  private generateCardsHash(words: string[], interestTags: string[]): string {
    const sortedInterestTags = [...interestTags].sort().join(',');
    const sortedWords = [...words].sort().join(',');
    const combinedString = `${sortedWords}|${sortedInterestTags}`;
    return CryptoHelper.calculateSHA256(combinedString);
  }

  /**
   * 过滤出未生成过的单词
   */
  private async filterWords(
    words: string[],
    interestTags: string[],
    limit: number,
    userId: string,
  ): Promise<{ filteredWords: string[]; existingHashes: string[] }> {
    const filteredWords: string[] = [];
    const existingHashes: string[] = [];
    const chunkSize = this.defaultConfig.maxWordsPerBatch || 5;

    for (let i = 0; i < words.length; i += chunkSize) {
      if (filteredWords.length >= limit) {
        break;
      }

      const chunk = words.slice(i, i + chunkSize);
      const hash = this.generateCardsHash(chunk, interestTags);

      // 检查哈希是否已存在
      const exists = await this.cards_db.get(hash);
      if (exists) {
        existingHashes.push(hash);
      } else {
        filteredWords.push(...chunk);
      }
    }

    // 保存用户已有的卡片哈希
    const userCardKey = `user_cards:${userId}`;
    await this.user_cards_db.saveArray(userCardKey, existingHashes);

    return {
      filteredWords: filteredWords.slice(0, limit),
      existingHashes,
    };
  }

  /**
   * 生成学习卡片（主要方法）
   */
  async generateStudyCards(
    request: CardGenerationRequest,
    config?: AIGenerationConfig,
  ): Promise<CardGenerationResult> {
    const {
      userId,
      words,
      interestTags = [],
      vocabularyType = VocabularyType.TEST,
    } = request;

    const mergedConfig = { ...this.defaultConfig, ...config };

    // 构建带兴趣标签的提示词
    const interestTagsString =
      interestTags.length > 0
        ? `The user is interested in topics such as: ${interestTags.join(', ')}. `
        : '';
    const finalPrompt = interestTagsString + (mergedConfig.systemPrompt || '');

    return this.addToQueue(async () => {
      // 过滤已存在的单词
      const { filteredWords, existingHashes } = await this.filterWords(
        words,
        interestTags,
        mergedConfig.maxWordsPerBatch || 5,
        userId,
      );

      if (filteredWords.length === 0) {
        return {
          cards: [],
          hashedIds: existingHashes,
        };
      }

      // 调用AI生成内容
      const generatedCards = await this.callAIService(
        filteredWords,
        finalPrompt,
        mergedConfig,
      );

      // 保存生成的卡片
      const newHashes = await this.saveGeneratedCards(
        generatedCards,
        interestTags,
        vocabularyType,
        userId,
      );

      return {
        cards: generatedCards,
        hashedIds: [...existingHashes, ...newHashes],
      };
    });
  }

  /**
   * 调用AI服务生成内容
   */
  private async callAIService(
    words: string[],
    systemPrompt: string,
    config: AIGenerationConfig,
  ): Promise<GeneratedCard[]> {
    const geminiConfig: any = {
      systemInstruction: systemPrompt,
    };

    if (config.proxyUrl) {
      geminiConfig.proxyUrl = config.proxyUrl;
    }

    const apiKey = config.apiKey || this.getRandomGeminiApiKey();
    const gemini = new GeminiHelper(apiKey, geminiConfig);

    const response = await gemini.sendMessage(words.join(','));

    // 解析响应
    return this.parseAIResponse(response);
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): GeneratedCard[] {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const generatedSentences = JSON.parse(jsonString);

      if (!Array.isArray(generatedSentences)) {
        console.error('AI response is not an array:', generatedSentences);
        throw new Error(
          'Invalid response format from AI service: Not an array',
        );
      }

      // 验证并过滤有效的句子
      return generatedSentences.filter((sentence, index) => {
        if (
          !sentence ||
          typeof sentence !== 'object' ||
          !sentence.mixed_chinese ||
          !sentence.english_only ||
          !sentence.fill_in_blanks ||
          !Array.isArray(sentence.used_words)
        ) {
          console.warn(
            `Invalid sentence object structure at index ${index}:`,
            sentence,
          );
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error(
        'Failed to parse AI response as JSON:',
        error,
        'Raw response:',
        response,
      );
      throw new Error('Invalid response format from AI service');
    }
  }

  /**
   * 保存生成的卡片
   */
  private async saveGeneratedCards(
    generatedCards: GeneratedCard[],
    interestTags: string[],
    vocabularyType: VocabularyType,
    userId: string,
  ): Promise<string[]> {
    const hashes: string[] = [];

    for (const card of generatedCards) {
      const hash = this.generateCardsHash(card.used_words, interestTags);

      const studyCard: StudyCard = {
        vocabularyType,
        interestTags,
        words: card.used_words,
        mixedChinese: card.mixed_chinese,
        englishOnly: card.english_only,
        fillInBlanks: card.fill_in_blanks,
      };

      await this.cards_db.put(hash, studyCard);
      hashes.push(hash);
    }

    // 更新用户的卡片列表
    const userCardKey = `user_cards:${userId}`;
    await this.user_cards_db.saveArray(userCardKey, hashes);

    return hashes;
  }

  /**
   * 获取用户的学习卡片
   */
  async getUserCards(userId: string): Promise<StudyCard[]> {
    const userCardKey = `user_cards:${userId}`;
    const cardHashes = await this.user_cards_db.getAllArray(userCardKey);

    if (!cardHashes || cardHashes.length === 0) {
      return [];
    }

    const cards: StudyCard[] = [];
    for (const hash of cardHashes) {
      const card = await this.cards_db.get(hash);
      if (card) {
        cards.push(card);
      }
    }

    return cards;
  }

  /**
   * 根据哈希获取卡片
   */
  async getCardByHash(hash: string): Promise<StudyCard | null> {
    return await this.cards_db.get(hash);
  }

  /**
   * 删除用户的学习卡片
   */
  async deleteUserCards(userId: string): Promise<boolean> {
    const userCardKey = `user_cards:${userId}`;
    await this.user_cards_db.delete(userCardKey);
    return true;
  }

  /**
   * 获取随机的Gemini API密钥
   */
  private getRandomGeminiApiKey(): string {
    // 这里应该从配置中读取API密钥列表
    // 暂时返回一个占位符
    const apiKeys = process.env.GEMINI_API_KEYS?.split(',') || ['default-key'];
    const randomIndex = Math.floor(Math.random() * apiKeys.length);
    return apiKeys[randomIndex];
  }

  /**
   * 将任务添加到处理队列
   */
  private async addToQueue<T>(task: () => Promise<T>): Promise<T> {
    this.processingQueue = this.processingQueue
      .then(() => task())
      .catch((error) => {
        console.error('Error in queue processing:', error);
        return null;
      });

    return this.processingQueue as Promise<T>;
  }
}

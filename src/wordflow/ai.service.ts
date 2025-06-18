import { Injectable, forwardRef, Inject } from '@nestjs/common';
import {
  db_tables,
  PGKVDatabase,
  DBService,
  keys,
} from 'src/common/db.service';
import { UserMetaDto } from 'src/user/dto/userMeta.dto';
import { CryptoHelper, GeminiHelper } from 'src/helpers/sdk';
import { prompt } from 'src/config/prompt';
import { config } from 'src/config';
import { WordflowService } from './wordflow.service';
import { WordFlowVocabularyType } from 'src/types/wordFlow';
import { CardsType } from 'src/types/wordFlow';
@Injectable()
export class AiService {
  private processingQueue: Promise<any> = Promise.resolve();
  private user_meta_db: PGKVDatabase;
  private cards_db: PGKVDatabase;
  constructor(
    private readonly dbService: DBService,
    @Inject(forwardRef(() => WordflowService))
    private readonly wordflowService: WordflowService,
  ) {
    this.user_meta_db = this.dbService.getDBInstance(db_tables.user_meta);
    this.cards_db = this.dbService.getDBInstance(db_tables.cards_db);
  }
  getRandomGeminiApiKey() {
    const apiKeys = config.GEMINI_API_KEYS;
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEYS is not configured or is empty.');
    }
    const randomIndex = Math.floor(Math.random() * apiKeys.length);
    const apiKey = apiKeys[randomIndex];
    return apiKey;
  }

  generateCardsHash(words: string[], user_interests: string[]): string {
    // Sort user interests once as they are used for every chunk
    const sortedUserInterests = [...user_interests].sort().join(',');
    // Sort all words
    const sortedWords = [...words].sort().join(',');
    // Combine sorted words and sorted user interests
    const combinedString = `${sortedWords}|${sortedUserInterests}`;
    const hash = CryptoHelper.calculateSHA256(combinedString);
    return hash;
  }
  async filterWords(
    words: string[],
    user_meta: UserMetaDto,
    limit: number,
    user_wfdb: PGKVDatabase,
  ) {
    const user_interests = user_meta.interest_tag || [];
    const filtered_words: string[] = [];
    const chunkSize = 5;
    const exists_hashs: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      if (filtered_words.length >= limit) {
        break;
      }

      const chunk = words.slice(i, i + chunkSize);
      const hash = this.generateCardsHash(chunk, user_interests);

      // Check if the hash exists in the database
      const exists = await this.cards_db.get(hash);
      if (exists) {
        exists_hashs.push(hash);
      }

      // If the hash does not exist, add the words from this chunk to the filtered list
      if (!exists) {
        filtered_words.push(...chunk);
      }
    }
    await user_wfdb.saveArray(keys.user_study_cards, exists_hashs);

    // Ensure the final list does not exceed the limit
    return filtered_words.slice(0, limit);
  }

  async generateStudyCards(words: string[], user_id: string) {
    // 将当前任务加入队列，确保按顺序执行
    const user_meta = await this.wordflowService.getUserMeta(user_id);
    const user_wfdb = this.wordflowService.getUserWFDB(user_id);
    const user_study_cards = await user_wfdb.get(keys.user_study_cards);
    const { current_vocabulary, interest_tag } = user_meta;

    // Construct the prompt dynamically, including interest tags
    const interest_tags_string =
      interest_tag && interest_tag.length > 0
        ? `The user is interested in topics such as: ${interest_tag.join(', ')}. `
        : '';
    const prompt_with_interest =
      interest_tags_string + prompt.word_flow_card_generation;

    return this.addToQueue(async () => {
      // Here you would typically call your AI model with prompt_with_interest and words
      // For now, we'll just return the words as before.
      const gemini_config: any = {
        systemInstruction: prompt_with_interest,
      };
      if (config.proxyUrl) {
        gemini_config.proxyUrl = config.proxyUrl;
      }

      const gemini = new GeminiHelper(
        this.getRandomGeminiApiKey(),
        gemini_config,
      );
      const filtered_words = await this.filterWords(
        words,
        user_meta,
        config.LIMIT_BATCH_WORDS,
        user_wfdb,
      );
      const response = await gemini.sendMessage(filtered_words.join(','));

      // Parse the response into JSON array
      let generated_sentences;
      try {
        // Extract JSON part if the response contains markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response;

        generated_sentences = JSON.parse(jsonString);

        // Validate the expected structure and filter out invalid ones
        if (!Array.isArray(generated_sentences)) {
          console.error('AI response is not an array:', generated_sentences);
          throw new Error(
            'Invalid response format from AI service: Not an array',
          );
        }

        const valid_sentences = generated_sentences.filter(
          (sentence, index) => {
            if (
              !sentence || // Check if sentence object is null or undefined
              typeof sentence !== 'object' || // Check if sentence is an object
              !sentence.mixed_chinese ||
              !sentence.english_only ||
              !sentence.fill_in_blanks ||
              !Array.isArray(sentence.used_words)
            ) {
              console.warn(
                `Invalid sentence object structure at index ${index}:`,
                sentence,
              );
              return false; // Filter out invalid sentences
            }
            return true; // Keep valid sentences
          },
        );
        // TODO 需要处理后存入cardsdb ,预留 图片处理。

        generated_sentences = valid_sentences;
      } catch (error) {
        console.error(
          'Failed to parse AI response as JSON:',
          error,
          'Raw response:',
          response,
        );
        throw new Error('Invalid response format from AI service');
      }
      const hashs: any = [];
      for (const sentence of generated_sentences) {
        const hash = this.generateCardsHash(
          sentence.used_words,
          user_meta.interest_tag || [],
        );
        const card: CardsType = {
          vocabularyType:
            user_meta.current_vocabulary || WordFlowVocabularyType.TEST,
          interest_tag: user_meta.interest_tag || [],
          words: sentence.used_words,
          image: '',
          mixed_chinese: sentence.mixed_chinese,
          english_only: sentence.english_only,
          fill_in_blanks: sentence.fill_in_blanks,
        };
        await this.cards_db.put(hash, card);
        hashs.push(hash);
      }
      await user_wfdb.saveArray(keys.user_study_cards, hashs);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      return generated_sentences;
    });
  }

  private async addToQueue<T>(task: () => Promise<T>): Promise<T> {
    // 创建一个新的Promise，它会在当前队列中的所有任务完成后执行
    this.processingQueue = this.processingQueue
      .then(() => task())
      .catch((error) => {
        console.error('Error in queue processing:', error);
        // 即使任务失败，也要确保队列继续运行
        return null;
      });

    return this.processingQueue as Promise<T>;
  }
}

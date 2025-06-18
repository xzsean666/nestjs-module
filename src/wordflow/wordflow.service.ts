import { Injectable, BadRequestException } from '@nestjs/common';
import {
  db_tables,
  PGKVDatabase,
  DBService,
  keys,
} from 'src/common/db.service';
import {
  WordFlowPhaseType,
  WordFlowCardType,
  WordFlowVocabularyType,
  WordFlowInterestTagType,
  WordFlowMarkedWordTag,
  WordEntry,
  GetWordsOptions,
  WordFlowSortBy,
  WordFlowSortOrder,
} from 'src/types/wordFlow';
import { UserMetaDto } from 'src/user/dto/userMeta.dto';
import { AiService } from './ai.service';
import { shuffle } from 'lodash';
import { config } from 'src/config';
import { CryptoHelper } from 'src/helpers/sdk';
import { cacheFn } from 'src/common/cache.service';
import { SubscriptionService } from 'src/wordflow/subscription.service';

@Injectable()
export class WordflowService {
  private user_meta_db: PGKVDatabase;
  private vocabularies_db: PGKVDatabase;
  private vocabularie_explains_db: PGKVDatabase;
  private cards_db: PGKVDatabase;
  constructor(
    private readonly dbService: DBService,
    private readonly aiService: AiService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.user_meta_db = this.dbService.getDBInstance(db_tables.user_meta);
    this.vocabularies_db = this.dbService.getDBInstance(db_tables.vocabularies);
    this.vocabularie_explains_db = this.dbService.getDBInstance(
      db_tables.vocabularie_explains,
    );
    this.cards_db = this.dbService.getDBInstance(db_tables.cards_db);
  }
  getUserWFDB(user_id: string): PGKVDatabase {
    return this.dbService.getDBInstance(`${db_tables.word_flow}_${user_id}`);
  }
  getUserKnownsCountLimint(
    phase_type: WordFlowPhaseType,
    card_type: WordFlowCardType,
  ) {
    if (card_type === WordFlowCardType.MIXED_CHINESE) {
      switch (phase_type) {
        case WordFlowPhaseType.BRUSH_WORDS:
          return 3;
        case WordFlowPhaseType.CONSOLIDATE:
          return 3;
        case WordFlowPhaseType.MEMORIZE_PRECISELY:
          return 1;
      }
    }
    if (card_type === WordFlowCardType.ENGLISH_ONLY) {
      switch (phase_type) {
        case WordFlowPhaseType.BRUSH_WORDS:
          return 3;
        case WordFlowPhaseType.CONSOLIDATE:
          return 3;
        case WordFlowPhaseType.MEMORIZE_PRECISELY:
          return 1;
      }
    }
    if (card_type === WordFlowCardType.FILL_IN_BLANKS) {
      switch (phase_type) {
        case WordFlowPhaseType.BRUSH_WORDS:
          return 1;
        case WordFlowPhaseType.CONSOLIDATE:
          return 1;
        case WordFlowPhaseType.MEMORIZE_PRECISELY:
          return 2;
      }
    }
    return 0;
  }

  async updateWordStatus(
    user_id: string,
    word: string,
    card_type: WordFlowCardType,
  ) {
    const userdb = this.getUserWFDB(user_id);
    const user_meta = await this.getUserMeta(user_id);
    const userWordsStatusKey = `${word}_${card_type}`;
    const userKnownKey = `${card_type}_knowns`;
    const userWordsStatus = await userdb.get(userWordsStatusKey);

    if (userWordsStatus) {
      const newcount = userWordsStatus.count + 1;
      await userdb.merge(userWordsStatusKey, { count: newcount });
      if (
        newcount >=
        this.getUserKnownsCountLimint(user_meta.study_phase!, card_type)
      ) {
        if (!userWordsStatus?.known) {
          const userKnowns = (await userdb.get(userKnownKey)) || [];
          const timestampnow = Date.now();
          userKnowns.push({ word, updated_at: timestampnow });
          await userdb.put(userKnownKey, userKnowns);
          await userdb.merge(userWordsStatusKey, { known: true });
        }
      }
    } else {
      await userdb.put(userWordsStatusKey, { count: 1 });
    }
  }
  async markWord(user_id: string, word: string, tag: WordFlowMarkedWordTag) {
    const userdb = this.getUserWFDB(user_id);
    const markedWordsKey = `${keys.user_marked_words}_${tag}`;
    const userMarkedWords = (await userdb.get(markedWordsKey)) || [];

    // Check if word already exists to avoid duplicates
    const existingWordIndex = userMarkedWords.findIndex(
      (item) => item.word === word,
    );

    if (existingWordIndex === -1) {
      userMarkedWords.push({ word, updated_at: Date.now(), tag });
      await userdb.put(markedWordsKey, userMarkedWords);
    } else {
      // Update timestamp if word already exists
      userMarkedWords[existingWordIndex].updated_at = Date.now();
      await userdb.put(markedWordsKey, userMarkedWords);
    }
  }
  async unmarkWord(user_id: string, word: string, tag: WordFlowMarkedWordTag) {
    const userdb = this.getUserWFDB(user_id);
    const markedWordsKey = `${keys.user_marked_words}_${tag}`;
    const userMarkedWords = (await userdb.get(markedWordsKey)) || [];

    // Filter out the word
    const updatedMarkedWords = userMarkedWords.filter(
      (item) => item.word !== word,
    );

    await userdb.put(markedWordsKey, updatedMarkedWords);
  }
  async getUserMarkedWords(
    user_id: string,
    tag?: WordFlowMarkedWordTag,
  ): Promise<WordEntry[]> {
    const userdb = this.getUserWFDB(user_id);

    if (tag) {
      // Get words for specific tag
      const markedWordsKey = `${keys.user_marked_words}_${tag}`;
      return (await userdb.get(markedWordsKey)) || [];
    } else {
      // Get words for all tags and combine
      const allTags = Object.values(WordFlowMarkedWordTag);
      const allMarkedWords: WordEntry[] = [];

      for (const currentTag of allTags) {
        const markedWordsKey = `${keys.user_marked_words}_${currentTag}`;
        const taggedWords = (await userdb.get(markedWordsKey)) || [];
        allMarkedWords.push(...taggedWords);
      }

      // Sort by timestamp (newest first) and remove duplicates (keep newest)
      const sortedWords = allMarkedWords.sort(
        (a, b) => (b.updated_at || 0) - (a.updated_at || 0),
      );
      const uniqueWords: WordEntry[] = [];
      const seenWords = new Set<string>();

      for (const item of sortedWords) {
        if (!seenWords.has(item.word)) {
          uniqueWords.push(item);
          seenWords.add(item.word);
        }
      }
      return uniqueWords;
    }
  }
  async getUserTagWords(
    user_id: string,
    tag: WordFlowMarkedWordTag,
    options?: GetWordsOptions,
  ): Promise<{ total: number; words: (WordEntry & { explanation?: any })[] }> {
    let words: WordEntry[] = [];
    switch (tag) {
      case WordFlowMarkedWordTag.KNOWN:
        words = await this.getUserKnowns(user_id);
        break;
      case WordFlowMarkedWordTag.UNKNOWN:
        words = await this.getUserUnknowns(user_id);
        break;
      case WordFlowMarkedWordTag.NEW_WORD:
        words = await this.getUserMarkedWords(user_id, tag);
        break;
    }

    // Apply search filter if specified
    if (options?.search) {
      const searchTerm = options.search.toLowerCase();
      words = words.filter((word) =>
        word.word.toLowerCase().includes(searchTerm),
      );
    }

    // Get total count after filtering but before pagination
    const total = words.length;

    // Apply sorting if specified
    if (options?.sortBy) {
      words.sort((a, b) => {
        if (options.sortBy === WordFlowSortBy.UPDATED_AT) {
          // Handle cases where updated_at might be undefined
          const dateA = a.updated_at || 0;
          const dateB = b.updated_at || 0;
          return options.sortOrder === WordFlowSortOrder.ASC
            ? dateA - dateB
            : dateB - dateA;
        } else if (options.sortBy === WordFlowSortBy.WORD) {
          const wordA = a.word.toLowerCase();
          const wordB = b.word.toLowerCase();
          return options.sortOrder === WordFlowSortOrder.ASC
            ? wordA.localeCompare(wordB)
            : wordB.localeCompare(wordA);
        }
        return 0;
      });
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || words.length;
    const paginatedWords = words.slice(offset, offset + limit);

    // Get explanations for paginated words
    const wordStrings = paginatedWords.map((word) => word.word);

    // Get individual explanations for each word to ensure proper matching
    const explanationsMap = new Map();
    for (const word of wordStrings) {
      try {
        const explanation = await this.getVocabularyExplains(word);
        if (explanation) {
          explanationsMap.set(word, explanation);
        }
      } catch (error) {
        // If explanation not found, continue without it
        console.warn(`No explanation found for word: ${word}`);
      }
    }

    // Combine words with their explanations using word matching
    const wordsWithExplanations = paginatedWords.map((word) => ({
      ...word,
      explanation: explanationsMap.get(word.word) || null,
    }));

    return {
      total,
      words: wordsWithExplanations,
    };
  }

  async markWordAsKnown(user_id: string, word: string) {
    // Use the enhanced markWord method with KNOWN tag
    await this.markWord(user_id, word, WordFlowMarkedWordTag.KNOWN);
  }
  async getUserKnowns(user_id: string): Promise<WordEntry[]> {
    const userdb = this.getUserWFDB(user_id);

    const userKnownsMIXED_CHINESE: WordEntry[] =
      (await userdb.get(keys.user_knowns_MIXED_CHINESE)) || [];
    const userKnownsENGLISH_ONLY: WordEntry[] =
      (await userdb.get(keys.user_knowns_ENGLISH_ONLY)) || [];
    const userKnownsFILL_IN_BLANKS: WordEntry[] =
      (await userdb.get(keys.user_knowns_FILL_IN_BLANKS)) || [];

    // Get manually marked known words from the new key structure
    const userMarkedKnowns: WordEntry[] = await this.getUserMarkedWords(
      user_id,
      WordFlowMarkedWordTag.KNOWN,
    );

    const userStudyKnowns: WordEntry[] = userKnownsMIXED_CHINESE.filter(
      (item) =>
        userKnownsMIXED_CHINESE.some((r) => r.word === item.word) &&
        userKnownsENGLISH_ONLY.some((f) => f.word === item.word) &&
        userKnownsFILL_IN_BLANKS.some((f) => f.word === item.word),
    );

    // Create a map of words from userMarkedKnowns for quick lookup
    const markedKnownsMap = new Map(
      userMarkedKnowns.map((item) => [item.word, item]),
    );

    // Filter out userStudyKnowns entries that exist in userMarkedKnowns
    const filteredStudyKnowns: WordEntry[] = userStudyKnowns.filter(
      (item) => !markedKnownsMap.has(item.word),
    );

    // Combine filtered lists and sort by timestamp (newest first)
    const combinedResults: WordEntry[] = [
      ...filteredStudyKnowns,
      ...userMarkedKnowns,
    ].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

    // Filter out older entries for the same word, keeping the newest due to sorting
    const uniqueResults: WordEntry[] = [];
    const seenWords = new Set<string>();

    for (const item of combinedResults) {
      if (!seenWords.has(item.word)) {
        uniqueResults.push(item);
        seenWords.add(item.word);
      }
    }

    return uniqueResults;
  }
  async getUserMeta(user_id: string): Promise<UserMetaDto> {
    const user_meta: UserMetaDto | null = await this.user_meta_db.get(user_id);
    if (!user_meta) {
      throw new Error('User meta not found');
    }
    if (!user_meta.study_phase) {
      throw new Error('Study phase not found');
    }
    if (!user_meta.current_vocabulary) {
      throw new Error('Vocabulary type not found');
    }
    return user_meta;
  }

  @cacheFn(60 * 5)
  async getUserVocabulary(user_id: string): Promise<string[]> {
    const user_meta: UserMetaDto = await this.getUserMeta(user_id);
    if (!user_meta.current_vocabulary) {
      throw new Error('Vocabulary type not found');
    }

    const vocabulary_words: string[] =
      (await this.vocabularies_db.get(
        user_meta.current_vocabulary.toLowerCase(),
      )) || [];
    return vocabulary_words;
  }
  async getUserUnknowns(user_id: string): Promise<WordEntry[]> {
    const userKnowns: WordEntry[] = await this.getUserKnowns(user_id);
    const vocabulary_words: string[] = await this.getUserVocabulary(user_id);

    const unknownWords: WordEntry[] = vocabulary_words
      .filter((word) => !userKnowns.some((known) => known.word === word))
      .map((word) => ({ word, tag: WordFlowMarkedWordTag.UNKNOWN }));
    return unknownWords;
  }
  async getVocabularyExplains(word: string) {
    const vocabulary_explains = await this.vocabularie_explains_db.get(word);
    return vocabulary_explains;
  }
  async getVocabularyExplainsBulk(words: string[]) {
    const vocabulary_explains_raw =
      await this.vocabularie_explains_db.getMany(words);
    const vocabulary_explains = vocabulary_explains_raw.map((item) => {
      return item.value;
    });
    return vocabulary_explains;
  }

  async generateStudyCards(user_id: string, limit: number): Promise<any[]> {
    // Check if the user has an active subscription
    const isSubscribed =
      await this.subscriptionService.isUserSubscribed(user_id);
    if (!isSubscribed) {
      // If not subscribed, throw an error
      throw new BadRequestException(
        'User is not subscribed to generate study cards',
      );
    }

    const user_wfdb = this.getUserWFDB(user_id);
    const user_study_cards = await user_wfdb.getAllArray(keys.user_study_cards);
    if (user_study_cards.length > limit) {
      return user_study_cards;
    }
    const unknownWords = await this.getUserUnknowns(user_id);

    // Shuffle the unknownWords array using lodash
    const shuffledWords = shuffle(unknownWords.map((entry) => entry.word));

    // 启动任务但不等待完成，任务会被加入队列按顺序执行
    this.aiService
      .generateStudyCards(shuffledWords, user_id)
      .catch((error) => console.error('Error generating study cards:', error));

    return [];
  }

  async markStudyCardsAsFavorites(user_id: string, cards: string[]) {
    const user_wfdb = this.getUserWFDB(user_id);

    // Use individual key-value pairs for each card's favorite status
    const promises = cards.map(async (card) => {
      const favoriteKey = `favorite_${card}`;
      await user_wfdb.put(favoriteKey, true);
    });

    // Execute all updates in parallel for better performance
    await Promise.all(promises);
  }

  async removeStudyCardsFromFavorites(user_id: string, cards: string[]) {
    const user_wfdb = this.getUserWFDB(user_id);

    // Remove favorite status by deleting the keys
    const promises = cards.map(async (card) => {
      const favoriteKey = `favorite_${card}`;
      await user_wfdb.delete(favoriteKey);
    });

    // Execute all deletions in parallel for better performance
    await Promise.all(promises);
  }

  async getStudyCardsFavorites(
    user_id: string,
    limit: number = 10,
    offset: number = 0,
    search?: string,
  ) {
    const user_wfdb = this.getUserWFDB(user_id);

    if (search && search.trim()) {
      // If search is provided, search in cards_db first, then filter by favorites
      const searchTerm = search.trim();

      // Use enhanced searchJson method for text search
      const searchResults = await this.cards_db.searchJson({
        textSearch: [
          {
            path: 'english_only',
            text: searchTerm,
            caseSensitive: false,
          },
        ],
        limit: 1000, // Get a large number of results for filtering
        includeTimestamps: true,
      });

      if (searchResults.data.length === 0) {
        return [];
      }

      // Get all favorite card IDs
      const favoriteEntries = await user_wfdb.getWithPrefix('favorite_', {
        limit: 10000, // Get all favorites
        orderBy: 'ASC',
      });

      const favoriteCardIds = new Set(
        favoriteEntries
          .filter((entry) => entry.value === true)
          .map((entry) => entry.key.slice(9)), // Remove 'favorite_' prefix
      );

      // Filter search results by favorites and apply pagination
      const filteredResults = searchResults.data
        .filter((card: any) => favoriteCardIds.has(card.key))
        .slice(offset, offset + limit);

      return filteredResults;
    } else {
      // Original logic when no search is provided
      // Use getWithPrefix to efficiently get all favorite-related keys
      const favoriteEntries = await user_wfdb.getWithPrefix('favorite_', {
        limit: limit * 2, // Get more entries in case some are false
        orderBy: 'ASC',
        offset: offset,
      });

      // Filter for entries that are actually favorited (value === true) and extract card IDs
      const favoriteCardIds: string[] = favoriteEntries
        .filter((entry) => entry.value === true)
        .map((entry) => entry.key.slice(9)) // Remove 'favorite_' prefix (9 characters)
        .slice(0, limit); // Apply the final limit

      if (favoriteCardIds.length === 0) {
        return [];
      }

      // Get full card data from cards database using getMany for better performance
      const cardEntries = await this.cards_db.getMany(favoriteCardIds, {
        includeTimestamps: true,
      });

      return cardEntries;
    }
  }
  async getStudyCardsHistory(
    user_id: string,
    limit: number = 10,
    offset: number = 0,
    search?: string,
  ) {
    const user_wfdb = this.getUserWFDB(user_id);

    if (search && search.trim()) {
      // If search is provided, search in cards_db first, then filter by history
      const searchTerm = search.trim();

      // Use enhanced searchJson method for text search
      const searchResults = await this.cards_db.searchJson({
        textSearch: [
          {
            path: 'english_only',
            text: searchTerm,
            caseSensitive: false,
          },
        ],
        limit: 1000, // Get a large number of results for filtering
        includeTimestamps: true,
      });

      if (searchResults.data.length === 0) {
        return [];
      }

      // Get all history card IDs
      const allHistory = await user_wfdb.getAllArray(
        keys.user_study_cards_history,
      );
      const historyCardIds = new Set(allHistory);

      // Filter search results by history and apply pagination
      const filteredResults = searchResults.data
        .filter((card: any) => historyCardIds.has(card.key))
        .slice(offset, offset + limit);

      return filteredResults;
    } else {
      // Original logic when no search is provided
      const historys = await user_wfdb.getRecentArray(
        keys.user_study_cards_history,
        limit,
        offset,
      );
      const full_data: any = [];
      for (const history of historys) {
        const data = await this.cards_db.get(history);
        full_data.push({ ...data, key: history });
      }
      return full_data;
    }
  }

  async getStudyCards(user_id: string, limit: number = 1) {
    const study_cards = await this.generateStudyCards(user_id, limit);

    const user_wfdb = this.getUserWFDB(user_id);
    if (study_cards.length == 0) {
      const randomCards = await this.cards_db.getRandomData(limit);
      const randomCardsArray = Array.isArray(randomCards)
        ? randomCards
        : Object.values(randomCards);
      const randomCardKeys = randomCardsArray.map(
        (card: { key: string; value: any }) => card.key,
      );
      await user_wfdb.saveArray(keys.user_study_cards_history, randomCardKeys);
      return randomCardsArray;
    }
    if (study_cards.length > limit) {
      // If more than limit cards, take the first 'limit' and save the rest
      const cardsToReturn = study_cards.slice(0, limit);
      const remainingCards = study_cards.slice(limit);
      // Append remaining cards to a separate key or structure for future use
      // A simple approach is to store them under a dedicated key, appending to an array

      // Clear the 'user_study_cards' key as these have now been processed
      await user_wfdb.saveArray(keys.user_study_cards, remainingCards, {
        overwrite: true,
      });
      await user_wfdb.saveArray(keys.user_study_cards_history, cardsToReturn);
      const cards = await this.cards_db.getMany(cardsToReturn);
      return cards;
    } else {
      // If limit or fewer cards, return them all and clear the key
      await user_wfdb.saveArray(keys.user_study_cards, [], {
        overwrite: true,
      });
      await user_wfdb.saveArray(keys.user_study_cards_history, study_cards);
      const cards = await this.cards_db.getMany(study_cards);
      return cards;
    }
  }
  async getUserVocabularyStatus(user_id: string) {
    const user_meta: any = await this.getUserMeta(user_id);

    const userMarkedKnowns: WordEntry[] = await this.getUserKnowns(user_id);
    const status: any = [];

    // 如果用户没有all_vocabulary，返回空数组
    if (!user_meta.all_vocabulary || !Array.isArray(user_meta.all_vocabulary)) {
      return status;
    }

    for (const vocabulary of user_meta.all_vocabulary) {
      const user_vocabulary = await this.vocabularies_db.get(
        vocabulary.vocabulary.toLowerCase(),
      );

      if (user_vocabulary && Array.isArray(user_vocabulary)) {
        // 计算已知单词数（在当前vocabulary中且用户已知的单词）
        const knownWordsCount = user_vocabulary.filter((word) =>
          userMarkedKnowns.some((known) => known.word === word),
        ).length;

        // 计算进度
        const totalWords = user_vocabulary.length;
        const unknownWords = totalWords - knownWordsCount;
        const progress =
          totalWords > 0 ? (knownWordsCount / totalWords) * 100 : 0;

        status.push({
          vocabulary: vocabulary.vocabulary,
          target_timestamp: vocabulary.target_timestamp,
          total_words: totalWords,
          known_words: knownWordsCount,
          unknown_words: unknownWords,
          progress: Math.round(progress * 100) / 100, // 保留两位小数
          is_current: vocabulary.vocabulary === user_meta.current_vocabulary, // 标记当前正在学习的vocabulary
        });
      }
    }

    return status;
  }
  /**
   * 生成基于当前日期的学习计划key
   * 格式: study_plans_YYYY-MM-DD
   * 用于存储每日的学习计划，确保每天只生成一次
   */
  generateStudyPlansKey() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `study_plans_${dateString}`;
  }

  async updateCurrentStudyPlan(user_id: string) {
    const user_wfdb = this.getUserWFDB(user_id);
    const todayKey = this.generateStudyPlansKey();

    // 检查今天是否已经生成过学习计划
    const todayStudyPlans = await user_wfdb.get(todayKey);

    if (!todayStudyPlans) {
      // 如果今天没有生成过学习计划，直接调用getStudyPlans
      return await this.getStudyPlans(user_id);
    }

    // 如果已经生成过，重新生成学习计划
    const new_study_plans = await this.generateUserStudyPlans(user_id);

    // 为新的学习计划添加生成时间戳和初始unknown状态
    const study_plans_with_metadata = {
      ...new_study_plans,
      generated_at: Date.now(),
      plan_date: new Date().toISOString().split('T')[0],
      initial_unknown_counts: new_study_plans.total_unknowns, // 保存开始时的unknown数量
    };

    // 更新今天的学习计划
    await user_wfdb.put(todayKey, study_plans_with_metadata);

    // 更新当前学习计划
    await user_wfdb.put(
      keys.user_study_plans_current,
      study_plans_with_metadata,
    );

    return study_plans_with_metadata;
  }

  /**
   * 获取用户学习计划
   * 逻辑：
   * 1. 检查今天是否已经生成过学习计划
   * 2. 如果已生成，直接返回今天的计划
   * 3. 如果未生成，则：
   *    - 记录上次的学习进度（通过unknown数量变化计算）
   *    - 生成新的学习计划
   *    - 保存今天的计划和更新当前计划
   */
  async getStudyPlans(user_id: string) {
    const user_wfdb = this.getUserWFDB(user_id);
    const todayKey = this.generateStudyPlansKey();

    // 先检查今天是否已经生成过学习计划
    const todayStudyPlans = await user_wfdb.get(todayKey);

    if (todayStudyPlans) {
      // 如果今天已经生成过，直接返回今天的学习计划
      return todayStudyPlans;
    }

    // 获取当前的学习计划（如果存在）来记录学习进度
    const current_study_plans = await user_wfdb.get(
      keys.user_study_plans_current,
    );

    // 生成新的学习计划（会获取最新的unknown状态）
    const new_study_plans = await this.generateUserStudyPlans(user_id);

    // 如果存在之前的学习计划，记录学习进度
    if (current_study_plans && current_study_plans.plan_date) {
      let wordsLearnedSinceLast = 0;
      if (
        current_study_plans.initial_unknown_counts &&
        new_study_plans.total_unknowns
      ) {
        const previousUnknowns = current_study_plans.initial_unknown_counts;
        const currentUnknowns = new_study_plans.total_unknowns;

        // 使用MIXED_CHINESE作为基准计算unknown减少量
        const previousTotal = previousUnknowns.MIXED_CHINESE || 0;
        const currentTotal = currentUnknowns.MIXED_CHINESE || 0;

        wordsLearnedSinceLast = Math.max(0, previousTotal - currentTotal);
      }

      const goalsProgress = this.calculateGoalsProgress(
        current_study_plans.daily_goals || {},
        wordsLearnedSinceLast,
      );

      const progress_record = {
        ...current_study_plans,
        completed_at: Date.now(),
        final_unknown_counts: new_study_plans.total_unknowns,
        words_learned_count: wordsLearnedSinceLast,
        study_completion_rate: this.calculateStudyCompletionRateByUnknowns(
          current_study_plans,
          new_study_plans.total_unknowns,
        ),
        goals_progress: goalsProgress,
      };

      // 保存上次学习计划的最终进度记录（覆盖原有的计划记录）
      const previousPlanKey = `study_plans_${current_study_plans.plan_date}`;
      await user_wfdb.put(previousPlanKey, progress_record);
    }

    // 为新的学习计划添加生成时间戳和初始unknown状态
    const study_plans_with_metadata = {
      ...new_study_plans,
      generated_at: Date.now(),
      plan_date: new Date().toISOString().split('T')[0],
      initial_unknown_counts: new_study_plans.total_unknowns, // 保存开始时的unknown数量
    };

    // 保存今天的学习计划
    await user_wfdb.put(todayKey, study_plans_with_metadata);

    // 更新当前学习计划
    await user_wfdb.put(
      keys.user_study_plans_current,
      study_plans_with_metadata,
    );

    return study_plans_with_metadata;
  }

  /**
   * 计算goals完成情况
   */
  private calculateGoalsProgress(dailyGoals: any, wordsLearned: number) {
    const totalGoals = Object.values(dailyGoals).reduce(
      (sum: number, goal: unknown) => sum + (Number(goal) || 0),
      0,
    ) as number;

    const progress =
      totalGoals > 0 ? Math.round((wordsLearned / totalGoals) * 100) : 0;

    return {
      total_goals: totalGoals,
      words_learned: wordsLearned,
      completion_percentage: Math.min(100, progress), // 限制最大为100%
      is_completed: progress >= 100,
      goals_details: dailyGoals,
    };
  }

  /**
   * 基于unknown数量变化计算学习完成率
   */
  private calculateStudyCompletionRateByUnknowns(
    study_plan: any,
    currentUnknowns: any,
  ): number {
    if (!study_plan.initial_unknown_counts || !study_plan.daily_goals) return 0;

    const initialUnknowns = study_plan.initial_unknown_counts;
    const dailyGoals = study_plan.daily_goals;

    // 计算目标学习量（每日目标的总和）
    const targetLearning = Object.values(dailyGoals).reduce(
      (sum: number, goal: unknown) => sum + (Number(goal) || 0),
      0,
    ) as number;

    // 计算实际学习量（使用MIXED_CHINESE作为基准，因为它代表词汇的基本掌握情况）
    const initialTotal = initialUnknowns.MIXED_CHINESE || 0;
    const currentTotal = currentUnknowns.MIXED_CHINESE || 0;
    const actualLearning = Math.max(0, initialTotal - currentTotal);

    return targetLearning > 0
      ? Math.round((actualLearning / targetLearning) * 100)
      : 0;
  }

  /**
   * 获取特定日期的学习记录
   */
  async getDailyStudyRecord(user_id: string, date: string) {
    const user_wfdb = this.getUserWFDB(user_id);
    const planKey = `study_plans_${date}`;

    const dayRecord = await user_wfdb.get(planKey);
    if (!dayRecord) {
      return null;
    }

    // 如果这是今天的记录，获取当前实时状态
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      // 获取当前的unknown状态
      const currentUnknowns = await this.getUserUnknowns(user_id);
      const currentUnknownCounts = {
        MIXED_CHINESE: currentUnknowns.length,
        ENGLISH_ONLY: currentUnknowns.length, // 实际上是同一批词汇的不同学习模式
        FILL_IN_BLANKS: currentUnknowns.length,
      };

      // 计算今天学习的单词数（使用MIXED_CHINESE作为基准）
      let wordsLearnedToday = 0;
      if (dayRecord.initial_unknown_counts) {
        const initialTotal =
          dayRecord.initial_unknown_counts.MIXED_CHINESE || 0;
        const currentTotal = currentUnknownCounts.MIXED_CHINESE;
        wordsLearnedToday = Math.max(0, initialTotal - currentTotal);
      }

      // 计算今天的goals完成情况
      const goalsProgress = this.calculateGoalsProgress(
        dayRecord.daily_goals || {},
        wordsLearnedToday,
      );

      return {
        ...dayRecord,
        current_unknown_counts: currentUnknownCounts,
        words_learned_today: wordsLearnedToday,
        study_completion_rate: this.calculateStudyCompletionRateByUnknowns(
          dayRecord,
          currentUnknownCounts,
        ),
        goals_progress: goalsProgress,
        is_today: true,
      };
    }

    // 历史记录处理
    let historicalWordsLearned = dayRecord.words_learned_count || 0;
    let historicalTotalUnknown = 0;

    // 对于历史记录，如果有保存的学习数据就使用，否则尝试重新计算
    if (dayRecord.words_learned_count) {
      historicalWordsLearned = dayRecord.words_learned_count;
    } else if (
      dayRecord.initial_unknown_counts &&
      dayRecord.final_unknown_counts
    ) {
      // 使用getUserKnowns()作为基准重新计算历史记录
      const currentKnowns = await this.getUserKnowns(user_id);
      const vocabulary = await this.getUserVocabulary(user_id);

      // 计算历史的总unknown（基于当前的已知单词数）
      historicalTotalUnknown = vocabulary.length - currentKnowns.length;

      // 如果有初始和最终的unknown数据，可以计算当天的学习量
      const initialTotal = dayRecord.initial_unknown_counts.MIXED_CHINESE || 0;
      const finalTotal = dayRecord.final_unknown_counts.MIXED_CHINESE || 0;
      historicalWordsLearned = Math.max(0, initialTotal - finalTotal);
    }

    // 计算历史记录的goals完成情况
    const goalsProgress = this.calculateGoalsProgress(
      dayRecord.daily_goals || {},
      historicalWordsLearned,
    );

    return {
      ...dayRecord,
      words_learned_count: historicalWordsLearned,
      goals_progress: goalsProgress,
      is_today: false,
    };
  }

  /**
   * 获取学习统计汇总（最近N天）
   */
  async getStudyStatsSummary(user_id: string, days: number = 7) {
    const user_wfdb = this.getUserWFDB(user_id);
    const stats: Array<{
      date: string;
      words_learned: number;
      completion_rate: number;
      total_unknown: number;
      goals_progress: any;
    }> = [];
    let totalWordsLearned = 0;
    let studyDaysCount = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const dayRecord = await this.getDailyStudyRecord(user_id, dateString);
      if (dayRecord) {
        const wordsLearned =
          dayRecord.words_learned_today || dayRecord.words_learned_count || 0;
        totalWordsLearned += wordsLearned;
        if (wordsLearned > 0) studyDaysCount++;

        // 计算当天的总unknown数量 - 使用getUserKnowns()作为基准
        let totalUnknown = 0;
        if (dayRecord.total_words) {
          // 统一使用getUserKnowns()作为基准，无论是今天的记录还是历史记录
          const currentKnowns = await this.getUserKnowns(user_id);
          totalUnknown = dayRecord.total_words - currentKnowns.length;
        }

        stats.push({
          date: dateString,
          words_learned: wordsLearned,
          completion_rate: dayRecord.study_completion_rate || 0,
          total_unknown: totalUnknown,
          goals_progress: dayRecord.goals_progress || null,
        });
      }
    }

    return {
      period_days: days,
      total_words_learned: totalWordsLearned,
      study_days_count: studyDaysCount,
      average_words_per_day:
        studyDaysCount > 0 ? Math.round(totalWordsLearned / studyDaysCount) : 0,
      daily_records: stats.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  async getStudyPlansHistory(user_id: string, days: number = 7) {
    const user_wfdb = this.getUserWFDB(user_id);
    const history: any[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const planKey = `study_plans_${dateString}`;

      const planData = await user_wfdb.get(planKey);
      if (planData) {
        history.push({
          date: dateString,
          ...planData,
        });
      }
    }

    return history.sort((a, b) => b.date.localeCompare(a.date)); // 按日期降序排列
  }

  async getStudyProgressSummary(user_id: string) {
    const user_wfdb = this.getUserWFDB(user_id);
    const currentPlans = await user_wfdb.get(keys.user_study_plans_current);

    if (!currentPlans) {
      return null;
    }

    // 获取当前已知单词数
    const currentKnowns = await this.getUserKnowns(user_id);
    const currentKnownCount = currentKnowns.length;

    // 计算进度
    const totalWords = currentPlans.total_words;
    const progressPercentage =
      totalWords > 0 ? (currentKnownCount / totalWords) * 100 : 0;

    return {
      total_words: totalWords,
      known_words: currentKnownCount,
      unknown_words: totalWords - currentKnownCount,
      progress_percentage: Math.round(progressPercentage * 100) / 100,
      days_remaining: currentPlans.days_remaining,
      daily_goals: currentPlans.daily_goals,
      plan_date: currentPlans.plan_date,
      generated_at: currentPlans.generated_at,
    };
  }

  async generateUserStudyPlans(user_id: string) {
    const user_vocabulary: string[] = await this.getUserVocabulary(user_id);
    const user_meta: UserMetaDto = await this.getUserMeta(user_id);
    const user_wfdb = this.getUserWFDB(user_id);

    // 使用专门的函数获取当前的unknown单词
    const userUnknowns: WordEntry[] = await this.getUserUnknowns(user_id);
    const totalUnknownCount = userUnknowns.length;

    // 获取各模式的已知单词数量，用于计算不同模式的学习目标
    const userKnownsMIXED_CHINESE: WordEntry[] =
      (await user_wfdb.get(keys.user_knowns_MIXED_CHINESE)) || [];
    const userKnownsENGLISH_ONLY: WordEntry[] =
      (await user_wfdb.get(keys.user_knowns_ENGLISH_ONLY)) || [];
    const userKnownsFILL_IN_BLANKS: WordEntry[] =
      (await user_wfdb.get(keys.user_knowns_FILL_IN_BLANKS)) || [];

    // 获取手动标记的已知单词
    const userMarkedKnowns: WordEntry[] = await this.getUserMarkedWords(
      user_id,
      WordFlowMarkedWordTag.KNOWN,
    );

    // 合并手动标记的已知单词到各模式的已知列表中，并去重
    const combinedKnownsMIXED_CHINESE = Array.from(
      new Set([
        ...userKnownsMIXED_CHINESE.map((entry) => entry.word),
        ...userMarkedKnowns.map((entry) => entry.word),
      ]),
    );

    const combinedKnownsENGLISH_ONLY = Array.from(
      new Set([
        ...userKnownsENGLISH_ONLY.map((entry) => entry.word),
        ...userMarkedKnowns.map((entry) => entry.word),
      ]),
    );

    const combinedKnownsFILL_IN_BLANKS = Array.from(
      new Set([
        ...userKnownsFILL_IN_BLANKS.map((entry) => entry.word),
        ...userMarkedKnowns.map((entry) => entry.word),
      ]),
    );

    // 计算各模式的未知单词数量
    const unknownCountMIXED_CHINESE =
      user_vocabulary.length - combinedKnownsMIXED_CHINESE.length;
    const unknownCountENGLISH_ONLY =
      user_vocabulary.length - combinedKnownsENGLISH_ONLY.length;
    const unknownCountFILL_IN_BLANKS =
      user_vocabulary.length - combinedKnownsFILL_IN_BLANKS.length;

    const target_timestamp_raw = user_meta.target_timestamp;
    const target_timestamp = Number(target_timestamp_raw);

    const now = Date.now();

    // Ensure target_timestamp is a valid number
    if (isNaN(target_timestamp)) {
      throw new Error(
        'target_timestamp is not defined or is not a valid number in user metadata',
      );
    }

    const diffMilliseconds = target_timestamp - now;
    // Calculate the difference in days, minimum 1 day
    const diffDays = Math.max(
      1,
      Math.ceil(diffMilliseconds / (1000 * 60 * 60 * 24)),
    );

    // 计算每日学习目标，基于总的未知单词数量
    const dailyTargetBase = Math.ceil(totalUnknownCount / diffDays);

    return {
      days_remaining: diffDays,
      total_unknowns: {
        MIXED_CHINESE: unknownCountMIXED_CHINESE,
        ENGLISH_ONLY: unknownCountENGLISH_ONLY,
        FILL_IN_BLANKS: unknownCountFILL_IN_BLANKS,
      },
      daily_goals: {
        MIXED_CHINESE: Math.ceil(
          dailyTargetBase * config.word_flow.study_ratio[0],
        ),
        ENGLISH_ONLY: Math.ceil(
          dailyTargetBase * config.word_flow.study_ratio[1],
        ),
        FILL_IN_BLANKS: Math.ceil(
          dailyTargetBase * config.word_flow.study_ratio[2],
        ),
      },
      total_words: user_vocabulary.length,
    };
  }

  async getStudyCardsV0(user_id: string) {
    const unknownWords: WordEntry[] = await this.getUserUnknowns(user_id);
    const user_meta: UserMetaDto = await this.getUserMeta(user_id);

    const target_timestamp_raw = user_meta.target_timestamp;
    const target_timestamp = Number(target_timestamp_raw);

    const now = Date.now();

    // Ensure target_timestamp is a valid number
    if (isNaN(target_timestamp)) {
      throw new Error(
        'target_timestamp is not defined or is not a valid number in user metadata',
      );
    }

    const diffMilliseconds = target_timestamp - now;
    // Calculate the difference in days, minimum 1 day
    const diffDays = Math.max(
      1,
      Math.ceil(diffMilliseconds / (1000 * 60 * 60 * 24)),
    );

    // Shuffle the unknownWords array using lodash
    const shuffledWords = shuffle(unknownWords.map((entry) => entry.word));

    // Calculate chunk size and return the first chunk
    const chunkSize = Math.ceil(shuffledWords.length / diffDays);
    const studyWordsChunk = shuffledWords.slice(0, chunkSize);
    // 启动任务但不等待完成，任务会被加入队列按顺序执行
    this.aiService
      .generateStudyCards(studyWordsChunk, user_id)
      .catch((error) => console.error('Error generating study cards:', error));

    return true;
  }

  async updateWordsStatusBulk(
    user_id: string,
    words: string[],
    card_type: WordFlowCardType,
  ) {
    const userdb = this.getUserWFDB(user_id);
    const user_meta: UserMetaDto = await this.getUserMeta(user_id);
    const userKnownKey = `${card_type}_knowns`;
    const knownLimit = this.getUserKnownsCountLimint(
      user_meta.study_phase!,
      card_type,
    );

    // Fetch all necessary word statuses and user knowns in bulk if possible,
    // or iterate and update one by one.
    // For simplicity, iterating and updating one by one similar to the single word function.

    const userKnowns: WordEntry[] = (await userdb.get(userKnownKey)) || [];
    const timestampnow = Date.now();

    for (const word of words) {
      const userWordsStatusKey = `${word}_${card_type}`;
      const userWordsStatus = await userdb.get(userWordsStatusKey);

      if (userWordsStatus) {
        const newcount = userWordsStatus.count + 1;
        await userdb.merge(userWordsStatusKey, { count: newcount });

        if (newcount >= knownLimit) {
          if (!userWordsStatus?.known) {
            // Check if word is already in userKnowns to avoid duplicates
            if (!userKnowns.some((item: WordEntry) => item.word === word)) {
              userKnowns.push({ word, updated_at: timestampnow });
              // Defer put of userKnowns until loop finishes for potential performance gain
            }
            await userdb.merge(userWordsStatusKey, { known: true });
          }
        }
      } else {
        await userdb.put(userWordsStatusKey, { count: 1 });
      }
    }
    // Put the updated userKnowns list after processing all words
    if (userKnowns.length > ((await userdb.get(userKnownKey)) || []).length) {
      // Only update if new words were added
      await userdb.put(userKnownKey, userKnowns);
    }
  }
}

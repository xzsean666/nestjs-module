import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { WordflowService } from './wordflow.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../common/auth.guard.service';
import { User, WordFlowCardType, WordFlowMarkedWordTag } from 'src/types';
import {
  WordContentDto,
  BaseWordDto,
  StudyPlanDto,
  UpdateWordStatusInput,
  UpdateWordsStatusBulkInput,
  MarkedWordDto,
  WordTagInput,
  GetWordsOptionsInput,
  TagWordsResult,
} from './dto';
import GraphQLJSON from 'graphql-type-json';

@Resolver()
@UseGuards(AuthGuard)
export class WordflowResolver {
  constructor(private readonly wordflowService: WordflowService) {}

  @Query(() => [BaseWordDto])
  async getUserKnowns(@CurrentUser() user: User): Promise<BaseWordDto[]> {
    const words = await this.wordflowService.getUserKnowns(user.user_id);
    return words.map((word) => ({
      word: word.word,
      ...(word.updated_at && { updated_at: word.updated_at }),
    }));
  }

  @Query(() => [String])
  async getUserVocabulary(@CurrentUser() user: User): Promise<string[]> {
    return this.wordflowService.getUserVocabulary(user.user_id);
  }

  @Query(() => [String])
  async getUserUnknowns(@CurrentUser() user: User): Promise<string[]> {
    const words = await this.wordflowService.getUserUnknowns(user.user_id);
    return words.map((word) => word.word);
  }

  @Query(() => GraphQLJSON, { nullable: true })
  async getVocabularyExplains(
    @Args('word') word: string,
  ): Promise<WordContentDto | null> {
    return this.wordflowService.getVocabularyExplains(word);
  }

  @Query(() => GraphQLJSON)
  async getVocabularyExplainsBulk(
    @Args('words', { type: () => [String] }) words: string[],
  ): Promise<any> {
    const vocabulary_explains_map =
      await this.wordflowService.getVocabularyExplainsBulk(words);

    // Convert the array to an array of objects suitable for GraphQL
    return vocabulary_explains_map;
  }

  @Query(() => GraphQLJSON)
  async getStudyCards(
    @Args('limit', { defaultValue: 1 }) limit: number,
    @CurrentUser() user: User,
  ): Promise<any> {
    const study_cards = await this.wordflowService.getStudyCards(
      user.user_id,
      limit,
    );
    return study_cards;
  }

  @Query(() => GraphQLJSON)
  async getStudyCardsFavorites(
    @Args('limit', { defaultValue: 10 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
    @CurrentUser() user: User,
    @Args('search', { nullable: true }) search?: string,
  ): Promise<any> {
    const favorite_cards = await this.wordflowService.getStudyCardsFavorites(
      user.user_id,
      limit,
      offset,
      search,
    );
    return favorite_cards;
  }

  @Query(() => GraphQLJSON)
  async getStudyCardsHistory(
    @Args('limit', { defaultValue: 10 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
    @CurrentUser() user: User,
    @Args('search', { nullable: true }) search?: string,
  ): Promise<any> {
    const history_cards = await this.wordflowService.getStudyCardsHistory(
      user.user_id,
      limit,
      offset,
      search,
    );
    return history_cards;
  }

  @Query(() => StudyPlanDto)
  async getStudyPlans(@CurrentUser() user: User): Promise<StudyPlanDto> {
    return this.wordflowService.getStudyPlans(user.user_id);
  }

  @Query(() => GraphQLJSON)
  async getStudyPlansHistory(
    @CurrentUser() user: User,
    @Args('days', { defaultValue: 7 }) days: number,
  ): Promise<any> {
    return await this.wordflowService.getStudyPlansHistory(user.user_id, days);
  }

  @Query(() => GraphQLJSON, { nullable: true })
  async getStudyProgressSummary(@CurrentUser() user: User): Promise<any> {
    return await this.wordflowService.getStudyProgressSummary(user.user_id);
  }

  @Query(() => GraphQLJSON)
  async getUserVocabularyStatus(@CurrentUser() user: User): Promise<any> {
    return this.wordflowService.getUserVocabularyStatus(user.user_id);
  }

  @Mutation(() => Boolean)
  async updateWordStatus(
    @Args('input') input: UpdateWordStatusInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.updateWordStatus(
      user.user_id,
      input.word,
      input.card_type,
    );
    return true;
  }

  @Mutation(() => Boolean)
  async markWordAsKnown(
    @Args('word') word: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.markWordAsKnown(user.user_id, word);
    return true;
  }

  @Mutation(() => Boolean)
  async generateStudyCards(@CurrentUser() user: User): Promise<boolean> {
    await this.wordflowService.generateStudyCards(user.user_id, 10);
    return true;
  }

  @Mutation(() => Boolean)
  async updateCurrentStudyPlan(@CurrentUser() user: User): Promise<boolean> {
    await this.wordflowService.updateCurrentStudyPlan(user.user_id);
    return true;
  }

  @Mutation(() => Boolean)
  async updateWordsStatusBulk(
    @Args('input') input: UpdateWordsStatusBulkInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.updateWordsStatusBulk(
      user.user_id,
      input.words,
      input.card_type,
    );
    return true;
  }

  @Mutation(() => Boolean)
  async markStudyCardsAsFavorites(
    @Args('cards', { type: () => [String] }) cards: string[],
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.markStudyCardsAsFavorites(user.user_id, cards);
    return true;
  }

  @Mutation(() => Boolean)
  async removeStudyCardsFromFavorites(
    @Args('cards', { type: () => [String] }) cards: string[],
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.removeStudyCardsFromFavorites(
      user.user_id,
      cards,
    );
    return true;
  }

  @Query(() => [MarkedWordDto])
  async getUserMarkedWords(
    @CurrentUser() user: User,
    @Args('tag', { nullable: true, type: () => WordFlowMarkedWordTag })
    tag?: WordFlowMarkedWordTag,
  ): Promise<MarkedWordDto[]> {
    const words = await this.wordflowService.getUserMarkedWords(
      user.user_id,
      tag,
    );
    return words.map((word) => ({
      word: word.word,
      ...(word.updated_at && { updated_at: word.updated_at }),
      tag: word.tag || WordFlowMarkedWordTag.NEW_WORD,
    }));
  }

  @Query(() => TagWordsResult)
  async getUserTagWords(
    @CurrentUser() user: User,
    @Args('tag', { type: () => WordFlowMarkedWordTag })
    tag: WordFlowMarkedWordTag,
    @Args('options', { nullable: true })
    options?: GetWordsOptionsInput,
  ): Promise<TagWordsResult> {
    const result = await this.wordflowService.getUserTagWords(
      user.user_id,
      tag,
      options,
    );
    return {
      total: result.total,
      words: result.words.map((word) => ({
        word: word.word,
        updated_at: word.updated_at,
        tag: word.tag || tag,
        explanation: word.explanation,
      })),
    };
  }

  @Mutation(() => Boolean)
  async markWord(
    @Args('input') input: WordTagInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.markWord(user.user_id, input.word, input.tag);
    return true;
  }

  @Mutation(() => Boolean)
  async unmarkWord(
    @Args('input') input: WordTagInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.wordflowService.unmarkWord(user.user_id, input.word, input.tag);
    return true;
  }

  @Query(() => GraphQLJSON, { nullable: true })
  async getDailyStudyRecord(
    @CurrentUser() user: User,
    @Args('date') date: string,
  ): Promise<any> {
    return this.wordflowService.getDailyStudyRecord(user.user_id, date);
  }

  @Query(() => GraphQLJSON)
  async getStudyStatsSummary(
    @CurrentUser() user: User,
    @Args('days', { defaultValue: 7 }) days: number,
  ): Promise<any> {
    return this.wordflowService.getStudyStatsSummary(user.user_id, days);
  }
}

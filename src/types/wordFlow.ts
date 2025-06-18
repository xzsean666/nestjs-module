import { registerEnumType } from '@nestjs/graphql';

export enum WordFlowPhaseType {
  BRUSH_WORDS = 'brush_words',
  CONSOLIDATE = 'consolidate',
  MEMORIZE_PRECISELY = 'memorize_precisely',
}

export enum WordFlowCardType {
  MIXED_CHINESE = 'mixed_chinese',
  ENGLISH_ONLY = 'english_only',
  FILL_IN_BLANKS = 'fill_in_blanks',
}

export enum WordFlowVocabularyType {
  CET4 = 'cet-4',
  CET6 = 'cet-6',
  GRADUATEEXAM = 'graduateexam',
  TOEFL = 'toefl',
  IELTS = 'ielts',
  SAT = 'sat',
  GREHIGHFREQUENCY = 'grehighfrequency',
  TEST = 'test',
}

export enum WordFlowInterestTagType {
  WESTERNMUSIC = 'westernmusic',
  JPOPKPOP = 'jpopkpop',
  MOVIES = 'movies',
  PSYCHOLOGY = 'psychology',
  BUSINESSTECHNOLOGY = 'businesstechnology',
  GLOBALCUISINE = 'globalcuisine',
  WORLDTRAVEL = 'worldtravel',
  HISTORY = 'history',
  PHILOSOPHY = 'philosophy',
}

export enum WordFlowMarkedWordTag {
  VIP = 'V',
  ERROR = 'E',
  FORGET = 'F',
  KNOWN = 'K',
  UNKNOWN = 'U',
  NEW_WORD = 'N',
}

export enum WordFlowSortBy {
  UPDATED_AT = 'updated_at',
  WORD = 'word',
}

export enum WordFlowSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface CardsType {
  vocabularyType: WordFlowVocabularyType;
  interest_tag: WordFlowInterestTagType[];
  words: string[];
  image: string;
  mixed_chinese: string;
  english_only: string;
  fill_in_blanks: string;
}

export interface WordEntry {
  word: string;
  updated_at?: number;
  tag?: WordFlowMarkedWordTag;
}

registerEnumType(WordFlowCardType, {
  name: 'WordFlowCardType',
});
registerEnumType(WordFlowVocabularyType, {
  name: 'WordFlowVocabularyType',
});

registerEnumType(WordFlowInterestTagType, {
  name: 'WordFlowInterestTagType',
});

registerEnumType(WordFlowPhaseType, {
  name: 'WordFlowPhaseType',
});

registerEnumType(WordFlowMarkedWordTag, {
  name: 'WordFlowMarkedWordTag',
});

registerEnumType(WordFlowSortBy, {
  name: 'WordFlowSortBy',
});

registerEnumType(WordFlowSortOrder, {
  name: 'WordFlowSortOrder',
});

export interface GetWordsOptions {
  sortBy?: WordFlowSortBy;
  sortOrder?: WordFlowSortOrder;
  offset?: number;
  limit?: number;
  search?: string;
}

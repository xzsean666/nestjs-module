export enum VocabularyType {
  CET4 = 'CET4',
  CET6 = 'CET6',
  TOEFL = 'TOEFL',
  IELTS = 'IELTS',
  GRE = 'GRE',
  TEST = 'TEST',
  CUSTOM = 'CUSTOM',
}

export interface StudyCard {
  vocabularyType: VocabularyType;
  interestTags: string[];
  words: string[];
  image?: string;
  mixedChinese: string;
  englishOnly: string;
  fillInBlanks: string;
}

export interface CardGenerationRequest {
  userId: string;
  words: string[];
  interestTags?: string[];
  vocabularyType?: VocabularyType;
}

export interface CardGenerationResult {
  cards: GeneratedCard[];
  hashedIds: string[];
}

export interface GeneratedCard {
  used_words: string[];
  mixed_chinese: string;
  english_only: string;
  fill_in_blanks: string;
}

export interface UserCardData {
  userId: string;
  cardHashes: string[];
  lastGeneratedAt?: Date;
}

export interface AIGenerationConfig {
  apiKey?: string;
  systemPrompt?: string;
  proxyUrl?: string;
  maxWordsPerBatch?: number;
}

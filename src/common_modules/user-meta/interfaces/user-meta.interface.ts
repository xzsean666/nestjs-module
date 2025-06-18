export interface UserMeta {
  user_id?: string;
  current_vocabulary?: string;
  target_timestamp?: string;
  all_vocabulary?: VocabularyRecord[];
  [key: string]: any; // 允许其他元数据字段
}

export interface VocabularyRecord {
  vocabulary: string;
  target_timestamp: string;
}

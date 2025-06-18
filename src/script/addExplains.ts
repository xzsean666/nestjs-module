import { config } from '../config';
import { PGKVDatabase, GeminiHelper } from '../helpers/sdk';
import { prompt } from '../config/prompt';
import dotenv from 'dotenv';
dotenv.config();

const BATCH_SIZE = 20;

async function main() {
  // 1. 连接词库表和释义表
  const vocabDb = new PGKVDatabase(
    config.database.url,
    `${config.database.prefix}_vocabularies`,
  );
  const explainDb = new PGKVDatabase(
    config.database.url,
    `${config.database.prefix}_vocabularie_explains`,
  );

  // 2. 获取所有词库的所有词
  const vocabularyKeys = (await vocabDb.keys()) || [];
  console.log(`共${vocabularyKeys.length}个词库。`);
  let allWords: string[] = [];
  for (const key of vocabularyKeys) {
    const words = (await vocabDb.get(key)) || [];
    if (Array.isArray(words)) {
      allWords.push(...words);
    }
  }
  // 去重
  allWords = Array.from(new Set(allWords));
  console.log(`共${allWords.length}个词。`);
  // 3. 获取已释义的词
  const explainedKeys = (await explainDb.keys()) || [];
  const explainedSet = new Set(explainedKeys);

  // 4. 过滤未释义的词
  const toExplain = allWords.filter((w) => !explainedSet.has(w));
  console.log(`共${allWords.length}个词，${toExplain.length}个待释义。`);
  if (toExplain.length === 0) {
    console.log('所有词都已有释义，无需处理。');
    await vocabDb.close();
    await explainDb.close();
    return;
  }

  // 5. 初始化AI

  // 6. 分批处理
  for (let i = 0; i < toExplain.length; i += BATCH_SIZE) {
    const apiKeys = config.GEMINI_API_KEYS;
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEYS is not configured or is empty.');
    }
    const randomIndex = Math.floor(Math.random() * apiKeys.length);
    const apiKey = apiKeys[randomIndex];
    if (!apiKey) throw new Error('缺少 GEMINI_API_KEY');
    const ai = new GeminiHelper(apiKey, {
      systemInstruction: prompt.vocabulary_explanation,
      proxyUrl: 'http://127.0.0.1:7897',
    });
    const batch = toExplain.slice(i, i + BATCH_SIZE);
    console.log(`处理第${i + 1}~${i + batch.length}个词...`);
    try {
      const userPrompt = JSON.stringify(batch);
      const fullPrompt = `${prompt.vocabulary_explanation}\n${userPrompt}`;
      const response = await ai.sendMessage(fullPrompt);
      // 解析AI返回
      let explanations: any[] = [];
      try {
        explanations = JSON.parse(response);
      } catch (e) {
        // 尝试提取JSON
        const match = response.match(/\[.*\]/s);
        if (match) explanations = JSON.parse(match[0]);
        else throw e;
      }
      // 写入数据库
      const entries: [string, any][] = explanations.map((item: any) => [
        item.word,
        item,
      ]);
      await explainDb.putMany(entries);
      console.log(`已写入${entries.length}个释义。`);
    } catch (err) {
      console.error(`第${i + 1}组处理失败:`, err);
    }
    // 可选：每组间隔，防止API限流
    await new Promise((r) => setTimeout(r, 2000));
  }

  await vocabDb.close();
  await explainDb.close();
  console.log('全部完成！');
}

main().catch(console.error);

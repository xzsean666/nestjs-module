import { config } from '../config';
import { PGKVDatabase, GeminiHelper } from '../helpers/sdk';
import { prompt } from '../config/prompt';
import {
  SqliteKVDatabase,
  SqliteValueType,
} from '../helpers/utils/dbUtils/KVSqlite';
import dotenv from 'dotenv';
import { parseAIResponse } from '../utils/AI/aiUtils'; // Import the utility function
dotenv.config();

const SQLITE_DB_PATH = './ai_check_results.sqlite'; // Path for the SQLite database
const CHECK_TABLE_NAME = 'explanation_checks';

async function main() {
  console.log('Starting AI explanation check...');

  // 1. 连接释义表 (PG) 和检查结果表 (Sqlite)
  console.log('Connecting to PG database...');

  const explainDb = new PGKVDatabase(
    config.database.url,
    `${config.database.prefix}_vocabularie_explains`,
  );

  const checkResultDb = new SqliteKVDatabase(
    SQLITE_DB_PATH,
    CHECK_TABLE_NAME,
    SqliteValueType.JSON, // Store the check result JSON
  );

  try {
    // 2. 获取所有已释义的词和它们的释义
    // const test = await explainDb.get('abandon');
    // console.log(test);
    // const count = await explainDb.count();
    // console.log(count);
    // console.log('Fetching all explanations from PG database...');
    const allExplanationsMap = await explainDb.getAll(); // Get the Map

    // Convert the Map keys to an array and iterate over the Map for values
    const explainedWords = Array.from(allExplanationsMap.keys());
    const allExplanations: { [key: string]: any } = {};
    for (const [key, value] of allExplanationsMap.entries()) {
      allExplanations[key] = value;
    }

    console.log(`共${explainedWords.length}个词已有释义。`);

    if (explainedWords.length === 0) {
      console.log('PG database is empty, nothing to check.');
      return;
    }

    // 3. 初始化AI
    const apiKeys = config.GEMINI_API_KEYS;
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEYS is not configured or is empty.');
    }
    // Randomly select an API key

    let checkedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 4. 逐个检查并处理
    console.log('Starting individual checks...');
    for (const word of explainedWords) {
      const explanation = allExplanations[word];
      const randomIndex = Math.floor(Math.random() * apiKeys.length);
      const apiKey = apiKeys[randomIndex];
      if (!apiKey) throw new Error('缺少 GEMINI_API_KEY');
      const ai = new GeminiHelper(apiKey, {
        systemInstruction: prompt.vocabulary_explanation_check,
        proxyUrl: config.proxyUrl, // Assuming proxyUrl is in config
      });

      // Check if already processed
      const isChecked = await checkResultDb.has(word);
      if (isChecked) {
        console.log(`Word "${word}" already checked. Skipping.`);
        skippedCount++;
        continue;
      }

      console.log(`Checking word: "${word}"...`);

      try {
        // Send the explanation value directly to AI
        const checkPrompt = JSON.stringify(explanation);
        const response = await ai.sendMessage(checkPrompt);

        let result: any = {};
        try {
          // Use the utility function for parsing
          result = parseAIResponse(response);
          console.log(`Successfully parsed AI response for word "${word}".`);
        } catch (parseError: any) {
          console.error(
            `Failed to parse AI response for word "${word}":`,
            response,
            parseError,
          );
          // Store an error result if parsing fails
          result = {
            is_correct: false,
            feedback: `解析AI响应失败: ${parseError.message}`,
          };
          errorCount++;
        }

        // Ensure result structure is as expected
        if (
          typeof result.is_correct === 'boolean' &&
          typeof result.feedback === 'string'
        ) {
          await checkResultDb.put(word, result); // Store result individually
          console.log(`Finished checking "${word}". Result stored.`);
          checkedCount++;
        } else {
          console.error(
            `AI response for word "${word}" had unexpected structure after parsing:`,
            result,
          );
          // Store an error result
          await checkResultDb.put(word, {
            is_correct: false,
            feedback: `AI响应结构错误: ${JSON.stringify(result)}`,
          });
          errorCount++;
        }
      } catch (aiError: any) {
        console.error(`AI check failed for word "${word}":`, aiError);
        // Store an error result
        await checkResultDb.put(word, {
          is_correct: false,
          feedback: `AI检查失败: ${aiError.message}`,
        });
        errorCount++;
      }

      // Add a small delay between AI calls
      await new Promise((r) => setTimeout(r, 500)); // 500ms delay
    }

    console.log('AI explanation check completed.');
    console.log(
      `Summary: Checked ${checkedCount} words, Skipped ${skippedCount} words, Encountered ${errorCount} errors.`,
    );
  } catch (finalError) {
    console.error('An error occurred during the checking process:', finalError);
  } finally {
    // Ensure databases are closed
    await explainDb.close();
    await checkResultDb.close();
    console.log('Database connections closed.');
  }
}

main().catch(console.error);

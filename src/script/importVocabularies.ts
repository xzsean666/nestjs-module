import { config } from '../config';
import { PGKVDatabase } from '../helpers/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function importVocabularies() {
  const vocabularyDir = path.join(__dirname, 'vocabularys');
  const db = new PGKVDatabase(
    config.database.url,
    `${config.database.prefix}_vocabularies`,
  );

  try {
    // Read all JSON files from the vocabulary directory
    const files = fs
      .readdirSync(vocabularyDir)
      .filter((file) => file.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(vocabularyDir, file);
      const vocabularyName = path.basename(file, '.json');

      // Read and parse the JSON file
      const content = fs.readFileSync(filePath, 'utf-8');
      const words = JSON.parse(content);

      // Store the words in the database
      await db.put(vocabularyName.toLowerCase(), words);
      console.log(
        `Successfully imported ${words.length} words from ${vocabularyName}`,
      );
    }

    console.log('All vocabularies have been imported successfully!');
  } catch (error) {
    console.error('Error importing vocabularies:', error);
  } finally {
    await db.close();
  }
}

// Run the import
importVocabularies().catch(console.error);

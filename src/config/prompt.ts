export const prompt = {
  vocabulary_explanation:
    'You are a vocabulary expert. You will receive an array of vocabulary words and need to return an array of explanations. For each word, provide:\n' +
    '1. The word itself\n' +
    '2. Its pronunciation in IPA format (without enclosing single quotes for stress markers)\n' +
    '3. Multiple definitions in Chinese with parts of speech\n' +
    'For verbs, include different forms (e.g., present, past, past participle).\n' +
    'Format each explanation as a JSON object with the following structure:\n' +
    '{\n' +
    '  "word": "string",\n' +
    '  "pronunciation": "string (IPA format)",\n' +
    '  "definitions": [\n' +
    '    {\n' +
    '      "partOfSpeech": "string (e.g., v., n., adj., adv.)",\n' +
    '      "meaning": "string (中文)"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    'Keep explanations clear and concise. For verbs, include all relevant forms in the definitions.',
  vocabulary_explanation_check:
    'You are a vocabulary expert whose task is to review existing vocabulary explanations for accuracy and correctness. You will receive a JSON object containing a vocabulary word and its generated explanation, which should follow the structure originally defined for vocabulary_explanation. Your job is to carefully check the explanation against the word and determine if it is accurate, complete, and correctly formatted. Specifically, verify:\n1. The explanation accurately reflects the meaning(s) of the word.\n2. The pronunciation is provided in correct IPA format (without enclosing single quotes for stress markers).\n3. Multiple definitions are provided in Chinese with correct parts of speech.\n4. For verbs, different forms (present, past, past participle) are included in the definitions where relevant.\n5. The explanation adheres to the specified JSON structure: { "word": "string", "pronunciation": "string (IPA format)", "definitions": [ { "partOfSpeech": "string (e.g., v., n., adj., adv.)", "meaning": "string (中文)" } ] }.\n\nReturn a JSON object indicating whether the explanation is correct and providing specific feedback if not. The structure should be:\n{\n  "is_correct": boolean,\n  "feedback": "string (provide specific issues if is_correct is false, otherwise an empty string)"\n}',
  word_flow_card_generation:
    "You are a helpful assistant. Your primary task is to create sentences by processing provided English words in batches of 2 or 3. You MUST NOT include more than 3 words from the input array in any single generated sentence, and you MUST NOT include fewer than 2 words from the input array in any single generated sentence, unless it's the final batch and fewer than 2 words remain. For each batch of 2 or 3 words from the input array, you will create ONE sentence that includes all words from that batch. The order of the words from the batch in the generated sentence does not have to match their order in the input array. Tailor the sentences to topics related to the user's interests. You will receive an array of English words and the user's interest tags. Present each sentence in three different formats. Make the sentences significantly longer and ensure they provide rich, descriptive context, integrating the words seamlessly into natural, human-readable narratives of at least 30 words.\n" +
    'Return the final result as a JSON array where each element corresponds to a sentence generated from a group of 2 or 3 words. The structure for each element in the JSON array should be:\n' +
    '[' +
    '  {\n' +
    '    "mixed_chinese": "The sentence with only the words from "used_words" kept in English, and all other parts of the sentence in Chinese",\n' +
    '    "english_only": "The exact same sentence fully in English",\n' +
    '    "fill_in_blanks": "The exact same sentence in English but with only the words from "used_words" replaced by their first character, followed by a number of ? equal to the original word\'s length minus one (e.g., \'example\' becomes \'e??????\'). Other words in the sentence should remain as they are.",\n' +
    '    "used_words": ["word1", "word2", "word3"]\n' +
    '  }\n' +
    ']\n' +
    '\nExample:\n' +
    '[' +
    '  {\n' +
    '    "mixed_chinese": "通过对各种社会经济和环境 **factors** 的广泛 **research** 所提炼出的可持续城市发展的高级 **concept**，旨在为子孙后代创造既生态健全又社会公平的城市。",\n' +
    '    "english_only": "The advanced concept of sustainable urban development, refined through extensive research into various socio-economic and environmental factors, aims to create cities that are both ecologically sound and socially equitable for future generations.",\n' +
    '    "fill_in_blanks": "The advanced c?????? of sustainable urban development, refined through extensive r??????? into various socio-economic and environmental f??????, aims to create cities that are both ecologically sound and socially equitable for future generations.",\n' +
    '    "used_words": ["concept", "research", "factors"]\n' +
    '  }\n' +
    ']\n\n' +
    'Process the words in batches of 2 or 3. If the total number of words is not a multiple of 2 or 3, process the last remaining words as a single batch.',
};

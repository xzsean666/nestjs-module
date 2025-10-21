import { Injectable } from '@nestjs/common';
import { GeminiHelper } from '../../helpers/sdk';
import { config } from '../../config';
@Injectable()
export class AiService {
  constructor() {}
  static getGeminiHelper(systemInstruction: string) {
    const apiKeys = config.GEMINI_API_KEYS;
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    const proxyUrl = config.proxyUrl;
    return new GeminiHelper(apiKey, {
      systemInstruction,
      proxyUrl,
    });
  }
}

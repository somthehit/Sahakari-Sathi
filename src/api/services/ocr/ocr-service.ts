import { OcrExtractedData, OcrProvider } from './types';
import { GeminiOcrProvider } from './providers/gemini';

export class OcrService {
  private provider: OcrProvider;

  constructor() {
    // We can switch this based on env vars if we add more providers
    // const providerName = process.env.OCR_PROVIDER || 'gemini';
    this.provider = new GeminiOcrProvider();
  }

  public async extractText(base64Image: string, documentType: string): Promise<OcrExtractedData> {
    if (!base64Image) {
      throw new Error("No image data provided");
    }

    // Delegate to the configured provider
    return await this.provider.extractText(base64Image, documentType);
  }
}

export const ocrService = new OcrService();

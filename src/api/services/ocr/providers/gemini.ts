import { GoogleGenAI } from "@google/genai";
import { OcrProvider, OcrExtractedData } from "../types";

export class GeminiOcrProvider implements OcrProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
    });
  }

  async extractText(base64Image: string, documentType: string): Promise<OcrExtractedData> {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY' || process.env.GEMINI_API_KEY.length < 20) {
      throw new Error("GEMINI_API_KEY is not configured. Please set a valid Gemini API key in your .env file.");
    }

    // Strip the data:image/...;base64, prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      You are an expert OCR AI system specialized in extracting structured data from Nepali and international identity documents.
      
      Document Type Expected: ${documentType}
      
      Please analyze the provided image and extract the following information. 
      Respond ONLY with a valid JSON object matching this structure exactly (omit any fields you cannot confidently read):
      {
        "documentType": "${documentType}",
        "confidenceScore": <number between 0 and 100 representing your confidence>,
        "fullNameEn": "<Name in English if available>",
        "fullNameNp": "<Name in Nepali if available>",
        "citizenshipNo": "<Citizenship or ID number if available>",
        "issueDistrict": "<Issue district if available>",
        "issueDateBS": "<Issue Date in BS (YYYY-MM-DD) if available>",
        "dobBS": "<Date of Birth in BS (YYYY-MM-DD) if available>",
        "fatherName": "<Father's name if available>",
        "spouseName": "<Spouse's name if available>",
        "address": "<Address if available>",
        "rawTextSnippet": "<A raw stream of all the text you see in the document, separated by pipes '|'>"
      }
      
      Do not include any markdown formatting like \`\`\`json, just the raw JSON object.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: 'image/jpeg', // Assuming jpeg, Gemini generally handles various image formats if base64 is provided
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          temperature: 0.1, // Low temperature for factual extraction
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response from Gemini API.");
      }

      // Parse the JSON
      const data: OcrExtractedData = JSON.parse(responseText);
      
      // Ensure documentType and confidenceScore are present
      return {
        ...data,
        documentType: documentType as any,
        confidenceScore: data.confidenceScore || 90,
      };

    } catch (error: any) {
      console.error("Gemini OCR Error:", error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }
}

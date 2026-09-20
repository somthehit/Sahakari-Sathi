export interface OcrExtractedData {
  documentType: 'citizenship_front' | 'citizenship_back' | 'passport' | 'license';
  confidenceScore: number;
  fullNameEn?: string;
  fullNameNp?: string;
  citizenshipNo?: string;
  issueDistrict?: string;
  issueDateBS?: string;
  dobBS?: string;
  fatherName?: string;
  spouseName?: string;
  address?: string;
  rawTextSnippet?: string;
}

export interface OcrProvider {
  extractText(base64Image: string, documentType: string): Promise<OcrExtractedData>;
}

import { Request, Response } from 'express';
import { ocrService } from '../services/ocr/ocr-service';

export class OcrController {
  static async extract(req: Request, res: Response) {
    try {
      const { imageBase64, docType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      if (!docType) {
        return res.status(400).json({ error: 'Document type (docType) is required' });
      }

      const extractedData = await ocrService.extractText(imageBase64, docType);
      
      return res.status(200).json(extractedData);
    } catch (error: any) {
      console.error('OCR Extraction Error:', error);
      return res.status(500).json({ error: 'Failed to extract data from image', details: error.message });
    }
  }
}

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { readCoopStore, writeCoopStore, getEmptyCoopStore } from './coopStore';
import apiRouter from '../api/routes';
import { initChequeTables } from '../db/initChequeTables';
import { initSavingsDepositsTables } from '../db/initSavingsDepositsTables';
import { initPassbookTables } from '../db/initPassbookTables';
import { initSignatureVerificationTables } from '../db/initSignatureVerificationTables';
import { initShareAccountTables } from '../db/initShareAccountTables';
import { initAgmTables } from '../db/initAgmTables';
import { initAuditEngineTables } from '../db/initAuditEngineTables';
import { initDocumentTemplateTables } from '../db/initDocumentTemplateTables';
import { initPlatformControlTables } from '../db/initPlatformControlTables';
import { initSecurityQuestions } from '../db/initSecurityQuestions';
import { publicRateLimit } from '../api/middleware/rateLimitMiddleware';

let _tablesInitialized = false;

export function ensureTablesInitialized() {
  if (_tablesInitialized) return;
  _tablesInitialized = true;

  initChequeTables().catch(() => {});
  initSavingsDepositsTables().catch(() => {});
  initPassbookTables().catch(() => {});
  initSignatureVerificationTables().catch(() => {});
  initShareAccountTables().catch(() => {});
  initAgmTables().catch(() => {});
  initAuditEngineTables().catch(() => {});
  initDocumentTemplateTables().catch(() => {});
  initPlatformControlTables().catch(() => {});
  initSecurityQuestions().catch(() => {});

  setTimeout(async () => {
    try {
      const { DatabaseSettingsService } = await import('../api/services/DatabaseSettingsService');
      const svc = new DatabaseSettingsService();
      const applied = await svc.applySavedConfig();
      if (applied) console.log('[Server] Database config loaded from database_settings');
    } catch {
      // no saved config yet
    }
  }, 2000);
}

export function createApp() {
  ensureTablesInitialized();

  const app = express();

  // Trust reverse proxy (Vercel / AWS / load balancers)
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  app.use(express.json({ limit: '20mb' }));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors());

  // Request tracing
  app.use((req, res, next) => {
    const requestId =
      (req.headers['x-request-id'] as string) ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (!req.path.startsWith('/api/')) return;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const user = (req as any).user?.username || '-';
      console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms ${requestId} user=${user}`);
    });
    next();
  });

  // AI endpoint rate limiter
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests from this IP, please try again shortly.' },
  });

  // Mount Main ERP API Layer
  app.use('/api/v1', apiRouter);

  // Health check API with system diagnostics
  app.get('/api/health', async (_req, res) => {
    let dbConnected = false;
    let dbError: string | null = null;
    try {
      const { checkDbHealth } = await import('../db/client');
      dbConnected = await checkDbHealth();
    } catch (e: any) {
      dbError = e.message;
    }

    const hasDbUrl = Boolean(
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.DIRECT_URL
    );
    const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const hasAnonKey = Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
    const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
      diagnostics: {
        databaseConfigured: hasDbUrl,
        databaseConnected: dbConnected,
        databaseError: dbError,
        supabaseUrlConfigured: hasSupabaseUrl,
        supabaseAnonKeyConfigured: hasAnonKey,
        supabaseServiceKeyConfigured: hasServiceRoleKey,
      },
    });
  });

  // Coop Database API Endpoints
  app.get('/api/coop/store', (req, res) => {
    try {
      const store = readCoopStore();
      res.json(store);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read coop store', details: err.message });
    }
  });

  app.post('/api/coop/store', publicRateLimit, (req, res) => {
    try {
      const updatedData = req.body;
      if (!updatedData || typeof updatedData !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
      }
      writeCoopStore(updatedData);
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save coop store', details: err.message });
    }
  });

  app.post('/api/coop/reset', publicRateLimit, (req, res) => {
    try {
      const freshStore = getEmptyCoopStore();
      writeCoopStore(freshStore);
      res.json({ success: true, store: freshStore, message: 'Database reset to clean state with no mock data.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset coop store', details: err.message });
    }
  });

  // Gemini AI client
  const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  app.post('/api/ai/chat', aiLimiter, async (req, res) => {
    try {
      const { messages, systemInstruction, model } = req.body;
      const ai = getAIClient();
      const targetModel = model || 'gemini-3.6-flash';

      const formattedContents = (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction || "You are SahakariSathi AI, an expert Financial Cooperative and Banking Operations Assistant for Nepal's SACCOS.",
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in /api/ai/chat:', error);
      res.status(500).json({ error: error.message || 'Failed to process chat request' });
    }
  });

  app.post('/api/ai/search-grounded', aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt || "What are the latest Nepal Rastra Bank regulatory norms for SACCOS and cooperative PEARLS monitoring in 2025/2026?",
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = searchChunks?.map((chunk: any) => ({
        title: chunk.web?.title,
        uri: chunk.web?.uri,
      })).filter((s: any) => s.uri) || [];

      res.json({ text: response.text, sources });
    } catch (error: any) {
      console.error('Error in /api/ai/search-grounded:', error);
      res.status(500).json({ error: error.message || 'Failed to execute search grounded query' });
    }
  });

  app.post('/api/ai/analyze-image', aiLimiter, async (req, res) => {
    try {
      const { imageBase64, mimeType, prompt } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 parameter' });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            text: prompt || 'Extract and analyze all text, voucher details, member numbers, amounts, signatures, or official seal details in this cooperative document.',
          },
        ],
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in /api/ai/analyze-image:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze image' });
    }
  });

  app.post('/api/ai/quick-assist', aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt || 'Summarize accounting voucher posting rules in 2 concise sentences.',
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in /api/ai/quick-assist:', error);
      res.status(500).json({ error: error.message || 'Quick assist request failed' });
    }
  });

  app.post('/api/ai/deep-think', aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt || 'Analyze complex loan portfolio risk and PEARLS ratio degradation across branches.',
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in /api/ai/deep-think:', error);
      res.status(500).json({ error: error.message || 'Deep thinking analysis failed' });
    }
  });

  // 404 for unknown API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl, requestId: res.locals.requestId });
  });

  // Centralized error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || (err instanceof SyntaxError ? 400 : 500);
    console.error('[api:error]', err);
    res.status(status).json({
      error: err.message || (status >= 500 ? 'Internal Server Error' : 'Request failed'),
      message: err.message,
      requestId: res.locals.requestId,
    });
  });

  return app;
}

export const app = createApp();
export default app;

import 'dotenv/config';
import express from "express";
import { createServer as createHttpServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { readCoopStore, writeCoopStore, getEmptyCoopStore } from "./src/server/coopStore";
import apiRouter from "./src/api/routes";
import { startDailyForexSync } from "./src/api/services/DailyForexSync";
import { initChequeTables } from "./src/db/initChequeTables";
import { initSavingsDepositsTables } from "./src/db/initSavingsDepositsTables";
import { initPassbookTables } from "./src/db/initPassbookTables";
import { initSignatureVerificationTables } from "./src/db/initSignatureVerificationTables";
import { initShareAccountTables } from "./src/db/initShareAccountTables";
import { initAgmTables } from "./src/db/initAgmTables";
import { initAuditEngineTables } from "./src/db/initAuditEngineTables";
import { initDocumentTemplateTables } from "./src/db/initDocumentTemplateTables";
import { initPlatformControlTables } from "./src/db/initPlatformControlTables";
import { initSecurityQuestions } from "./src/db/initSecurityQuestions";
import { publicRateLimit } from "./src/api/middleware/rateLimitMiddleware";

process.on('unhandledRejection', (reason: any) => {
  console.error('[SERVER] Unhandled rejection:', reason?.message || reason);
});

async function startServer() {
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

  // Load saved database config after tables are initialized (2s delay for DDL)
  setTimeout(async () => {
    try {
      const { DatabaseSettingsService } = await import('./src/api/services/DatabaseSettingsService');
      const svc = new DatabaseSettingsService();
      const applied = await svc.applySavedConfig();
      if (applied) console.log('[Server] Database config loaded from database_settings');
    } catch { /* no saved config yet — using .env defaults */ }
  }, 2000);

  const app = express();

  const PORT = 3000;

  // Trust one reverse-proxy hop (load balancer) when deployed behind one, so
  // req.ip reflects the real client for the IP-keyed rate limits. Off by
  // default to avoid honoring spoofed X-Forwarded-For when exposed directly.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));

  app.use(express.json({ limit: "20mb" }));
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());

  // ── Request tracing + access log ─────────────────────────────────────────
  // Assigns a per-request id, measures duration, and logs API traffic. The
  // request id is echoed back on the response so client-side support can match
  // errors to server logs.
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

  // ── AI endpoint rate limiter ─────────────────────────────────────────────
  // Gemini calls are the most expensive requests on the server (per-token
  // billing), so they are throttled far below the generic API limiter.
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,             // 20 AI requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests from this IP, please try again shortly.' },
  });

  // Mount Main ERP API Layer
  app.use('/api/v1', apiRouter);

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // REAL COOP DATABASE API ENDPOINTS
  app.get("/api/coop/store", (req, res) => {
    try {
      const store = readCoopStore();
      res.json(store);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read coop store", details: err.message });
    }
  });

  app.post("/api/coop/store", publicRateLimit, (req, res) => {
    try {
      const updatedData = req.body;
      if (!updatedData || typeof updatedData !== 'object') {
        return res.status(400).json({ error: "Invalid payload" });
      }
      writeCoopStore(updatedData);
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save coop store", details: err.message });
    }
  });

  app.post("/api/coop/reset", publicRateLimit, (req, res) => {
    try {
      const freshStore = getEmptyCoopStore();
      writeCoopStore(freshStore);
      res.json({ success: true, store: freshStore, message: "Database reset to clean state with no mock data." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to reset coop store", details: err.message });
    }
  });

  // Initialize Gemini AI client safely
  const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
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

  // 1. Gemini Chatbot Endpoint
  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    try {
      const { messages, systemInstruction, model } = req.body;
      const ai = getAIClient();
      const targetModel = model || "gemini-3.6-flash";

      const formattedContents = (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
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
      console.error("Error in /api/ai/chat:", error);
      res.status(500).json({ error: error.message || "Failed to process chat request" });
    }
  });

  // 2. Search Grounded Financial/Regulatory Query Endpoint
  app.post("/api/ai/search-grounded", aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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
      console.error("Error in /api/ai/search-grounded:", error);
      res.status(500).json({ error: error.message || "Failed to execute search grounded query" });
    }
  });

  // 3. Image Analysis Endpoint (Analyze Document / Vouchers / Citizenship / Land Collateral)
  app.post("/api/ai/analyze-image", aiLimiter, async (req, res) => {
    try {
      const { imageBase64, mimeType, prompt } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 parameter" });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            },
          },
          {
            text: prompt || "Extract and analyze all text, voucher details, member numbers, amounts, signatures, or official seal details in this cooperative document.",
          },
        ],
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error in /api/ai/analyze-image:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image" });
    }
  });

  // 4. Low-Latency Quick Assistant (gemini-3.6-flash)
  app.post("/api/ai/quick-assist", aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt || "Summarize accounting voucher posting rules in 2 concise sentences.",
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error in /api/ai/quick-assist:", error);
      res.status(500).json({ error: error.message || "Quick assist request failed" });
    }
  });

  // 5. Deep Thinking Mode Endpoint (gemini-3.6-flash with HIGH thinkingLevel)
  app.post("/api/ai/deep-think", aiLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt || "Analyze complex loan portfolio risk and PEARLS ratio degradation across branches.",
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error in /api/ai/deep-think:", error);
      res.status(500).json({ error: error.message || "Deep thinking analysis failed" });
    }
  });

  // 404 for unknown API routes — JSON, never the SPA HTML fallback
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl, requestId: res.locals.requestId });
  });

  // Vite development middleware or static serve in production
  if (process.env.NODE_ENV !== "production") {
    const httpServer = createHttpServer(app);
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  // Auto-fetch the official NRB USD→NPR rate daily (best-effort)
  if (process.env.NODE_ENV !== "test") {
    startDailyForexSync();
  }

  // ── Centralized error handler ─────────────────────────────────────────────
  // Last middleware. Catches synchronous throws, next(err) calls, and malformed
  // JSON bodies (SyntaxError from express.json) so clients always receive a
  // structured JSON error instead of an HTML stack trace.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || (err instanceof SyntaxError ? 400 : 500);
    if (status >= 500) {
      console.error('[api:error]', err);
    }
    res.status(status).json({
      error: status >= 500 ? 'Internal Server Error' : (err.message || 'Request failed'),
      requestId: res.locals.requestId,
    });
  });
}

startServer();
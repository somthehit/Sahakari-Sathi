import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app';
import { startDailyForexSync } from './src/api/services/DailyForexSync';

process.on('unhandledRejection', (reason: any) => {
  console.error('[SERVER] Unhandled rejection:', reason?.message || reason);
});

async function startServer() {
  const PORT = 3000;

  // Vite development middleware or static serve in production
  if (process.env.NODE_ENV !== 'production') {
    const httpServer = createHttpServer(app);
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  // Auto-fetch the official NRB USD→NPR rate daily (best-effort)
  if (process.env.NODE_ENV !== 'test') {
    startDailyForexSync();
  }
}

startServer();
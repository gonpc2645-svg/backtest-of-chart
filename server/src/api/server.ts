import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { CONFIG } from '../config/index.js';
import { DatabaseService } from '../database/connection.js';
import { IngestionWorker } from '../services/ingestionWorker.js';
import { apiRouter } from './routes.js';

export function createServer() {
  const app = express();

  // Basic security and parsing middlewares
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Security Headers Middleware (Production Hardening)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' http://localhost:* ws: wss:; frame-ancestors 'self';"
    );
    next();
  });

  // Simple In-Memory Rate Limiter Middleware
  const clientRequests = new Map<string, { count: number; resetTime: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = clientRequests.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + CONFIG.API_PROTECTION.RATE_LIMIT_WINDOW_MS };
      clientRequests.set(ip, record);
    } else {
      record.count++;
      if (record.count > CONFIG.API_PROTECTION.RATE_LIMIT_MAX_REQUESTS) {
        const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please wait before making more requests.',
          retryAfter: retryAfterSeconds,
        });
      }
    }

    // Clean up old entries periodically
    if (clientRequests.size > 10000) {
      for (const [k, v] of clientRequests.entries()) {
        if (now > v.resetTime) clientRequests.delete(k);
      }
    }

    next();
  });

  // Request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[API ${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // API router mount
  app.use('/api', apiRouter);

  // Fallback 404 handler for unknown API routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Server Error]:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error.' });
  });

  return app;
}

export async function startServer(port: number = CONFIG.PORT) {
  const app = createServer();

  const server = app.listen(port, CONFIG.HOST, () => {
    console.log(`[Backtest of Chart API] Server listening on http://localhost:${port}`);
  });

  // Background catalog synchronization if empty
  const stats = DatabaseService.getInstance().getDatabaseStats();
  if (stats.instrumentsCount === 0) {
    const worker = new IngestionWorker();
    worker.syncInstrumentCatalogs().catch((err) => {
      console.warn('[Server Startup] Warning during initial instrument sync:', err);
    });
  }

  return server;
}

// Direct execution entrypoint
if (!process.env.TEST_MODE && (process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js'))) {
  startServer().catch((err) => {
    console.error('Fatal Server Error:', err);
    process.exit(1);
  });
}

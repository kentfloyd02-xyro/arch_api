import cors from 'cors';
import { env } from '../config/env.js';

const allowedOriginsList = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed list
    if (allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }

    // Check wildcard subdomain matching for *.archonnell.com
    try {
      const url = new URL(origin);
      if (
        url.hostname === 'archonnell.com' ||
        url.hostname.endsWith('.archonnell.com') ||
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL syntax
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
});

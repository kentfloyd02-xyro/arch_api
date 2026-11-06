import cors from 'cors';
import { env } from '../config/env.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOriginsList = (process.env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim().toLowerCase());

    if (allowedOriginsList.includes(origin.toLowerCase())) {
      return callback(null, true);
    }

    // Check domain matching for custom domains, subdomains, and hosting providers
    try {
      const url = new URL(origin);
      const h = url.hostname.toLowerCase();
      if (
        h === 'archonnellincorporated.com' ||
        h.endsWith('.archonnellincorporated.com') ||
        h === 'archonnell.com' ||
        h.endsWith('.archonnell.com') ||
        h.endsWith('.vercel.app') ||
        h.endsWith('.onrender.com') ||
        h === 'localhost' ||
        h === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL syntax
    }

    // Fallback: Safely allow origin instead of throwing an Error that destroys OPTIONS preflight
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Accept', 'Origin']
});

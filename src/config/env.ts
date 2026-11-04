import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:5432/archon_central'),
  DATABASE_BACKUP_URL: z.string().optional().default(''),
  DB_FAILOVER_ENABLED: z.string().default('false').transform((val) => val.toLowerCase() === 'true'),
  JWT_SECRET: z.string().default('archon_nell_super_secret_jwt_key_capstone_2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECRET: z.string().default('archon_nell_cookie_secret_dev'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  BREVO_SMTP_HOST: z.string().default('smtp-relay.brevo.com'),
  BREVO_SMTP_PORT: z.string().default('587').transform((val) => parseInt(val, 10)),
  BREVO_SMTP_USER: z.string().default(''),
  BREVO_SMTP_KEY: z.string().default(''),
  BREVO_FROM_EMAIL: z.string().default('kentfloyd02@gmail.com'),
  BREVO_FROM_NAME: z.string().default('Archon Nell Industrial')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

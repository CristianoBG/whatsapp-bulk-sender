import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_NAME: z.string().default('whatsapp-session'),
  MIN_DELAY_SECONDS: z.coerce.number().min(5).default(15),
  MAX_DELAY_SECONDS: z.coerce.number().min(10).default(35),
  LOG_LEVEL: z.enum(['info', 'debug', 'error', 'warn', 'silent']).default('info'),
  MAX_RETRIES: z.coerce.number().min(0).default(3),
  RETRY_INITIAL_DELAY_MS: z.coerce.number().min(100).default(2000),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

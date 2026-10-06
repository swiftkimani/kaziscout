import { z } from 'zod';

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_PATH: z.string().default('./var/kaziscout.sqlite'),
  FIRECRAWL_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  // Any OpenAI-compatible server (OpenAI, Gemini, DeepSeek, Groq, OpenRouter, Ollama, LM Studio).
  AI_BASE_URL: optionalSecret.pipe(z.url().optional()),
  AI_API_KEY: optionalSecret,
  AI_MODEL: optionalSecret,
  // 0 turns scheduled scans off. Boards are small sites, so the shortest interval is 15 minutes.
  SCAN_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .refine((minutes) => minutes === 0 || (minutes >= 15 && minutes <= 10_080), {
      message: 'must be 0 (off) or between 15 and 10080',
    })
    .default(0),
  ALERT_WEBHOOK_URL: optionalSecret.pipe(z.url().optional()),
  ALERT_MIN_SCORE: z.coerce.number().min(1).max(5).default(4),
  // Required before the server will listen on anything other than this computer.
  ACCESS_TOKEN: optionalSecret.pipe(
    z.string().min(16, 'must be at least 16 characters').optional(),
  ),
  DESKTOP_ASSIST_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Config = z.infer<typeof envSchema>;

/** Reads and validates configuration from the environment. Throws on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

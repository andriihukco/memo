import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8, "TELEGRAM_WEBHOOK_SECRET is required (min 8 chars, set in BotFather setWebhook)").optional(),
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  ENTRY_ENCRYPTION_PEPPER: z.string().min(32, "ENTRY_ENCRYPTION_PEPPER must be at least 32 chars (run: openssl rand -hex 32)"),
  MINIAPP_URL: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ENTRY_ENCRYPTION_PEPPER: process.env.ENTRY_ENCRYPTION_PEPPER,
    MINIAPP_URL: process.env.MINIAPP_URL,
  });

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    const message = `Missing required environment variable(s): ${missing}`;
    console.error(message);
    throw new Error(message);
  }

  _env = result.data;
  return _env;
}

// Lazy proxy — validation runs on first property access (at request time, not build time)
export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return validateEnv()[prop as keyof Env];
  },
});

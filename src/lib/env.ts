import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
    .regex(/^[0-9a-fA-F]+$/, "TOKEN_ENCRYPTION_KEY must be a valid hex string"),
  META_APP_ID: z.string().min(1, "META_APP_ID is required"),
  META_APP_SECRET: z.string().min(1, "META_APP_SECRET is required"),
  TIKTOK_CLIENT_KEY: z.string().min(1, "TIKTOK_CLIENT_KEY is required"),
  TIKTOK_CLIENT_SECRET: z.string().min(1, "TIKTOK_CLIENT_SECRET is required"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required"),
  S3_ACCESS_KEY: z.string().min(1, "S3_ACCESS_KEY is required"),
  S3_SECRET_KEY: z.string().min(1, "S3_SECRET_KEY is required"),
  S3_REGION: z.string().default("us-east-1"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(customEnv: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(customEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${errorDetails}`);
  }
  return result.data;
}

let cachedEnv: Env | null = null;

export function resetCachedEnv(): void {
  cachedEnv = null;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (!cachedEnv) {
      cachedEnv = validateEnv();
    }
    return (cachedEnv as unknown as Record<string, unknown>)[prop as string];
  },
});

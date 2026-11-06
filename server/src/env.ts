import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().optional().default(3001),
  CLIENT_ORIGIN: z.string().optional().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  FORCE_AI_FAILURE: z.string().optional().default(""),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  FORCE_AI_FAILURE: process.env.FORCE_AI_FAILURE,
});

export function currentAiMode(): "openai" | "mock" {
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "mock";
}

export function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || env.OPENAI_MODEL;
}

export const aiMode = currentAiMode();

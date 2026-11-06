import { z } from "zod";
import {
  CATEGORY_KEYS,
  type AnalysisReport,
  type CategoryScores,
} from "../../../shared/types.js";
import { aggregateOverall, clampScore } from "../../../shared/scores.js";
import { HttpError } from "./http.js";

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  ttsEnabled: z.boolean().optional(),
});

export const createDebateSchema = z.object({
  topic: z.string().trim().min(8).max(200),
  userPosition: z.enum(["proposition", "opposition"]),
  mode: z.enum(["text", "voice"]),
  durationSeconds: z.union([z.literal(60), z.literal(120), z.literal(180)]),
});

export const turnSchema = z.object({
  content: z.string().trim().min(10).max(4000).optional(),
  speakingDurationSeconds: z.number().positive().max(240).nullable().optional(),
});

export const startFloorSchema = z.object({
  floorIndex: z.number().int().min(0).max(3),
});

export const yieldFloorSchema = z.object({
  content: z.string().trim().max(4000).optional().default(""),
  speakingDurationSeconds: z.number().positive().max(240).nullable().optional(),
});

const feedbackSchema = z.object({
  title: z.string().min(1).max(160).catch("Observation"),
  evidenceQuote: z.string().max(400).catch(""),
  explanation: z.string().max(600).optional(),
  suggestion: z.string().max(600).optional(),
});

const fallacySchema = z.object({
  name: z.string().min(1).max(80),
  evidenceQuote: z.string().max(400).catch(""),
  explanation: z.string().max(600).catch(""),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
});

const categorySchema = z.object({
  logicalReasoning: z.coerce.number(),
  rebuttalQuality: z.coerce.number(),
  evidenceAndSupport: z.coerce.number(),
  clarityAndStructure: z.coerce.number(),
  responsiveness: z.coerce.number(),
});

export const analysisModelSchema = z.object({
  categoryScores: categorySchema,
  strengths: z.array(feedbackSchema).max(5).catch([]),
  weaknesses: z.array(feedbackSchema).max(5).catch([]),
  possibleFallacies: z.array(fallacySchema).max(5).catch([]),
  nextSteps: z.array(z.string().min(1).max(240)).max(5).catch([]),
});

export function parseBody<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new HttpError(400, "invalid_input", "Please check the form and try again.", result.error.flatten());
  }
  return result.data;
}

export function validateAnalysisDraft(
  draft: z.infer<typeof analysisModelSchema>,
  speechMetrics: AnalysisReport["speechMetrics"],
  rubricVersion: string,
): AnalysisReport {
  const categoryScores = {} as CategoryScores;
  for (const key of CATEGORY_KEYS) {
    categoryScores[key] = clampScore(Number(draft.categoryScores[key]) || 0);
  }

  return {
    overallScore: aggregateOverall(categoryScores),
    rubricVersion,
    categoryScores,
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    possibleFallacies: draft.possibleFallacies,
    speechMetrics,
    nextSteps: draft.nextSteps.length > 0 ? draft.nextSteps : ["Prepare a clearer claim, reason and example for the next round."],
  };
}

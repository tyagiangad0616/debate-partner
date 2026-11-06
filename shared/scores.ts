import {
  CATEGORY_KEYS,
  type AnalysisReport,
  type CategoryScores,
} from "./types.js";

export function aggregateOverall(scores: CategoryScores): number {
  const values = CATEGORY_KEYS.map((key) => scores[key]);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function roundForDisplay(score: number): number {
  return Math.round(score * 10) / 10;
}

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

export function clampScore(value: number): number {
  return Math.min(10, Math.max(0, value));
}

export function emptyCategoryScores(): CategoryScores {
  return {
    logicalReasoning: 0,
    rebuttalQuality: 0,
    evidenceAndSupport: 0,
    clarityAndStructure: 0,
    responsiveness: 0,
  };
}

export function withOverallScore(report: Omit<AnalysisReport, "overallScore">): AnalysisReport {
  return {
    ...report,
    overallScore: aggregateOverall(report.categoryScores),
  };
}

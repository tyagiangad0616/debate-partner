export type DebatePosition = "proposition" | "opposition";
export type DebateMode = "text" | "voice";
export type SessionStatus =
  | "created"
  | "active"
  | "completed"
  | "analysis_pending"
  | "analyzed"
  | "failed";

export type Speaker = "user" | "ai";

export const RUBRIC_VERSION = "v1" as const;

export const CATEGORY_KEYS = [
  "logicalReasoning",
  "rebuttalQuality",
  "evidenceAndSupport",
  "clarityAndStructure",
  "responsiveness",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type CategoryScores = Record<CategoryKey, number>;

export interface FeedbackItem {
  title: string;
  evidenceQuote: string;
  explanation?: string;
  suggestion?: string;
}

export interface FallacyCandidate {
  name: string;
  evidenceQuote: string;
  explanation: string;
  confidence: "low" | "medium" | "high";
}

export interface SpeechMetrics {
  wordCount: number;
  speakingDurationSeconds: number | null;
  wordsPerMinute: number | null;
  fillerWordCount: number;
  limitations: string[];
}

export interface AnalysisReport {
  overallScore: number;
  rubricVersion: string;
  categoryScores: CategoryScores;
  strengths: FeedbackItem[];
  weaknesses: FeedbackItem[];
  possibleFallacies: FallacyCandidate[];
  speechMetrics: SpeechMetrics;
  nextSteps: string[];
}

export interface DebateMessage {
  id: string;
  speaker: Speaker;
  content: string;
  turnNumber: number;
  createdAt: string;
  speakingDurationSeconds: number | null;
}

export interface DebateSessionSummary {
  id: string;
  topic: string;
  userPosition: DebatePosition;
  mode: DebateMode;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  overallScore: number | null;
  rubricVersion: string;
}

export interface DebateSessionDetail extends DebateSessionSummary {
  messages: DebateMessage[];
  analysis: AnalysisReport | null;
  floorIndex: number;
  floorPhase: string;
  floorStartedAt: string | null;
  extensionUsed: boolean;
}

export const SUGGESTED_TOPICS = [
  "Should university education be free?",
  "Is social media more harmful than beneficial for students?",
  "Should AI-generated work be allowed in academic assignments?",
  "Is remote learning as effective as in-person education?",
  "Should voting be compulsory in democratic countries?",
] as const;

export const DURATION_OPTIONS = [60, 120, 180] as const;

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  logicalReasoning: "Logical reasoning",
  rebuttalQuality: "Rebuttal quality",
  evidenceAndSupport: "Evidence and support",
  clarityAndStructure: "Clarity and structure",
  responsiveness: "Responsiveness",
};

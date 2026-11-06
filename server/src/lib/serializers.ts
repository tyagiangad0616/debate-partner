import type { DebateAnalysis, DebateMessage, DebateSession } from "@prisma/client";
import type {
  AnalysisReport,
  DebateMode,
  DebatePosition,
  DebateSessionDetail,
  DebateSessionSummary,
  SessionStatus,
  Speaker,
} from "../../../shared/types.js";

type SessionWithScore = DebateSession & { analysis?: DebateAnalysis | null };

export function serializeSession(session: SessionWithScore): DebateSessionSummary {
  return {
    id: session.id,
    topic: session.topic,
    userPosition: session.userPosition as DebatePosition,
    mode: session.mode as DebateMode,
    status: session.status as SessionStatus,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    durationSeconds: session.durationSeconds,
    overallScore: session.analysis?.overallScore ?? null,
    rubricVersion: session.rubricVersion,
  };
}

export function serializeMessage(message: DebateMessage) {
  return {
    id: message.id,
    speaker: message.speaker as Speaker,
    content: message.content,
    turnNumber: message.turnNumber,
    createdAt: message.createdAt.toISOString(),
    speakingDurationSeconds: message.speakingDurationSeconds,
  };
}

export function serializeAnalysis(row: DebateAnalysis): AnalysisReport {
  return {
    overallScore: row.overallScore,
    rubricVersion: "v1",
    categoryScores: row.categoryScores as unknown as AnalysisReport["categoryScores"],
    strengths: row.strengths as unknown as AnalysisReport["strengths"],
    weaknesses: row.weaknesses as unknown as AnalysisReport["weaknesses"],
    possibleFallacies: row.fallacies as unknown as AnalysisReport["possibleFallacies"],
    speechMetrics: row.speechMetrics as unknown as AnalysisReport["speechMetrics"],
    nextSteps: row.recommendations as unknown as AnalysisReport["nextSteps"],
  };
}

export function serializeDetail(
  session: DebateSession & { messages: DebateMessage[]; analysis: DebateAnalysis | null },
): DebateSessionDetail {
  return {
    ...serializeSession(session),
    messages: session.messages.map(serializeMessage),
    analysis: session.analysis
      ? { ...serializeAnalysis(session.analysis), rubricVersion: session.rubricVersion }
      : null,
    floorIndex: session.floorIndex,
    floorPhase: session.floorPhase,
    floorStartedAt: session.floorStartedAt?.toISOString() ?? null,
    extensionUsed: session.extensionUsed,
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  data?: unknown;

  constructor(status: number, code: string, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "request_failed",
      payload?.error?.message ?? "The request could not be completed.",
      payload?.data,
    );
  }
  return payload.data as T;
}

export const api = {
  health: () =>
    request<{ ok: boolean; aiMode: "openai" | "mock"; model: string; rubricVersion: string }>("/api/health"),
  register: (body: { displayName: string; email: string; password: string }) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request<{ id: string; displayName: string; email: string; ttsEnabled: boolean }>("/api/me"),
  updateMe: (body: { displayName?: string; ttsEnabled?: boolean }) =>
    request("/api/me", { method: "PATCH", body: JSON.stringify(body) }),
  dashboard: () => request<DashboardSummary>("/api/dashboard/summary"),
  createDebate: (body: {
    topic: string;
    userPosition: "proposition" | "opposition";
    mode: "text" | "voice";
    durationSeconds: 60 | 120 | 180;
  }) => request<DebateDetail>("/api/debates", { method: "POST", body: JSON.stringify(body) }),
  listDebates: () => request<{ items: DebateSummary[]; nextCursor: string | null }>("/api/debates"),
  getDebate: (id: string) => request<DebateDetail>(`/api/debates/${id}`),
  submitTurn: (id: string, body: { content?: string; speakingDurationSeconds?: number | null }) =>
    request<{ userTurn: DebateTurn | null; aiTurn: DebateTurn | null }>(`/api/debates/${id}/turns`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startFloor: (id: string, floorIndex: number) =>
    request<DebateDetail>(`/api/debates/${id}/floors/start`, {
      method: "POST",
      body: JSON.stringify({ floorIndex }),
    }),
  extendFloor: (id: string) => request<DebateDetail>(`/api/debates/${id}/floors/extend`, { method: "POST" }),
  yieldFloor: (id: string, body: { content?: string; speakingDurationSeconds?: number | null } = {}) =>
    request<DebateDetail>(`/api/debates/${id}/floors/yield`, { method: "POST", body: JSON.stringify(body) }),
  completeDebate: (id: string, body: { force?: boolean } = {}) =>
    request<DebateDetail>(`/api/debates/${id}/complete`, { method: "POST", body: JSON.stringify(body) }),
  deleteDebate: (id: string) => request(`/api/debates/${id}`, { method: "DELETE" }),
};

export interface DebateTurn {
  id: string;
  speaker: "user" | "ai";
  content: string;
  turnNumber: number;
  createdAt: string;
  speakingDurationSeconds: number | null;
}

export interface DebateSummary {
  id: string;
  topic: string;
  userPosition: "proposition" | "opposition";
  mode: "text" | "voice";
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  overallScore: number | null;
  rubricVersion: string;
}

export interface DebateDetail extends DebateSummary {
  messages: DebateTurn[];
  analysis: AnalysisReport | null;
  floorIndex: number;
  floorPhase: string;
  floorStartedAt: string | null;
  extensionUsed: boolean;
}

export interface AnalysisReport {
  overallScore: number;
  rubricVersion: string;
  categoryScores: {
    logicalReasoning: number;
    rebuttalQuality: number;
    evidenceAndSupport: number;
    clarityAndStructure: number;
    responsiveness: number;
  };
  strengths: Array<{ title: string; evidenceQuote: string; explanation?: string; suggestion?: string }>;
  weaknesses: Array<{ title: string; evidenceQuote: string; explanation?: string; suggestion?: string }>;
  possibleFallacies: Array<{
    name: string;
    evidenceQuote: string;
    explanation: string;
    confidence: "low" | "medium" | "high";
  }>;
  speechMetrics: {
    wordCount: number;
    speakingDurationSeconds: number | null;
    wordsPerMinute: number | null;
    fillerWordCount: number;
    limitations: string[];
  };
  nextSteps: string[];
}

export interface DashboardSummary {
  totalCompleted: number;
  totalSessions: number;
  averageScore: number | null;
  sampleCount: number;
  trend: Array<{
    id: string;
    startedAt: string;
    topic: string;
    overallScore: number | null;
    rubricVersion: string;
  }>;
  recent: DebateSummary[];
  active: DebateSummary | null;
}

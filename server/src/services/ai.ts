import OpenAI from "openai";
import { currentAiMode, configuredModel } from "../env.js";
import { analysisModelSchema, validateAnalysisDraft } from "../lib/validation.js";
import { opponentSystemPrompt, openingSystemPrompt, analysisSystemPrompt, floorSpeechPrompt } from "../lib/prompts.js";
import type { FloorRound } from "../../../shared/floors.js";
import { HttpError } from "../lib/http.js";
import type { AnalysisReport, DebatePosition, Speaker } from "../../../shared/types.js";
import { buildSpeechMetrics } from "../../../shared/metrics.js";

export interface TurnContext {
  topic: string;
  userPosition: DebatePosition;
  aiPosition: DebatePosition;
  messages: Array<{ speaker: Speaker; content: string }>;
}

export interface AnalysisContext extends TurnContext {
  speechTurns: Array<{ content: string; speakingDurationSeconds: number | null }>;
  rubricVersion: string;
}

function opposite(position: DebatePosition): DebatePosition {
  return position === "proposition" ? "opposition" : "proposition";
}

export { opposite };

function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 25_000 });
}

function mockOpening(topic: string, aiPosition: DebatePosition): string {
  if (aiPosition === "proposition") {
    return `We support the motion that "${topic}". The present arrangement leaves a preventable harm in place, and refusing the motion preserves that default. The case for change is that a clear public rule can reach people the status quo leaves out, without requiring us to pretend the policy is costless. I will defend a workable version of the motion and ask the opposition to show why the current harm is acceptable.`;
  }
  return `We oppose the motion that "${topic}". The proposition treats a slogan as if it were a mechanism: it has not shown who pays, what is displaced, or why the current arrangement cannot be improved without this change. Before we accept the motion we need a reason that survives those trade-offs. I will argue that the claimed benefit is overstated and that the opposition's burden is to prove the motion, not merely to name a problem.`;
}

function mockReply(ctx: TurnContext): string {
  if (ctx.messages.length === 0) {
    return mockOpening(ctx.topic, ctx.aiPosition);
  }
  const lastUser = [...ctx.messages].reverse().find((message) => message.speaker === "user");
  const excerpt = (lastUser?.content ?? "the opening claim").slice(0, 140);
  const stance =
    ctx.aiPosition === "proposition"
      ? "the motion should be carried"
      : "the motion should fall";

  return `The claim that "${excerpt}" is more asserted than established. If ${stance}, we still need a reason that survives a competing explanation. The argument leans on an untested assumption about what follows from the topic "${ctx.topic}", and it does not yet show why the alternative is worse. A stronger case would isolate one mechanism, give a concrete example, and answer the strongest objection rather than restating the conclusion.`;
}

function mockAnalysis(ctx: AnalysisContext, speechMetrics: AnalysisReport["speechMetrics"]): AnalysisReport {
  if (speechMetrics.wordCount === 0) {
    return validateAnalysisDraft(
      {
        categoryScores: {
          logicalReasoning: 0,
          rebuttalQuality: 0,
          evidenceAndSupport: 0,
          clarityAndStructure: 0,
          responsiveness: 0,
        },
        strengths: [],
        weaknesses: [
          {
            title: "No user argument was submitted",
            evidenceQuote: "(empty transcript)",
            suggestion: "Type a claim and click Send argument so the opponent can reply, then end the debate.",
          },
        ],
        possibleFallacies: [],
        nextSteps: [
          "Start a new debate and wait for the opponent opening.",
          "Write at least one argument of two or three sentences.",
          "Click Send argument before ending the round.",
        ],
      },
      speechMetrics,
      ctx.rubricVersion,
    );
  }

  const userText = ctx.speechTurns.map((turn) => turn.content).join(" ");
  const hasBecause = /\bbecause\b|\btherefore\b|\bevidence\b|\bfor example\b/i.test(userText);
  const hasRebuttal = ctx.messages.some((message) => message.speaker === "ai") && ctx.speechTurns.length > 0;
  const short = speechMetrics.wordCount < 40;
  const lengthBonus = Math.min(2, Math.floor(speechMetrics.wordCount / 40));

  const logicalReasoning = Math.min(10, (short ? 4 : hasBecause ? 7 : 5) + lengthBonus);
  const rebuttalQuality = Math.min(10, (hasRebuttal ? 6 : 4) + (ctx.speechTurns.length > 1 ? 1 : 0));
  const evidenceAndSupport = Math.min(10, (hasBecause ? 6 : 4) + lengthBonus);
  const clarityAndStructure = Math.min(10, (short ? 5 : 7) + (userText.includes("?") ? 0 : 1));
  const responsiveness = hasRebuttal ? 6 : 5;

  const quote = (ctx.speechTurns[0]?.content ?? "").slice(0, 180);

  return validateAnalysisDraft(
    {
      categoryScores: {
        logicalReasoning,
        rebuttalQuality,
        evidenceAndSupport,
        clarityAndStructure,
        responsiveness,
      },
      strengths: [
        {
          title: short ? "A position was stated" : "A central claim is identifiable",
          evidenceQuote: quote,
          explanation: "The transcript contains a usable starting claim for a short practice round.",
        },
      ],
      weaknesses: [
        {
          title: hasBecause ? "Limited engagement with the strongest objection" : "Support is thin",
          evidenceQuote: quote,
          suggestion: "Add one concrete example and answer the opponent's main premise directly.",
        },
      ],
      possibleFallacies: [],
      nextSteps: [
        "State the claim, one reason, and one example before concluding.",
        "Quote the opponent's strongest point and explain why it fails.",
        "Replace general assertions with a mechanism that can be tested.",
      ],
    },
    speechMetrics,
    ctx.rubricVersion,
  );
}

async function completeJson(system: string, user: string): Promise<string> {
  const openai = openaiClient();
  if (!openai) {
    throw new Error("OpenAI client is not configured");
  }
  const completion = await openai.chat.completions.create({
    model: configuredModel(),
    temperature: 0.3,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function completeText(system: string, user: string): Promise<string> {
  const openai = openaiClient();
  if (!openai) {
    throw new Error("OpenAI client is not configured");
  }
  const completion = await openai.chat.completions.create({
    model: configuredModel(),
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function generateOpponentReply(ctx: TurnContext): Promise<string> {
  if (process.env.FORCE_AI_FAILURE === "1") {
    throw new HttpError(503, "ai_unavailable", "The debate opponent is temporarily unavailable. Your argument was saved.");
  }

  const isOpening = ctx.messages.length === 0;
  const transcript = ctx.messages
    .slice(-8)
    .map((message) => `${message.speaker === "user" ? "User" : "Opponent"}: ${message.content}`)
    .join("\n");

  if (currentAiMode() === "mock") {
    return mockReply(ctx);
  }

  try {
    const reply = await completeText(
      isOpening
        ? openingSystemPrompt(ctx.topic, ctx.aiPosition)
        : opponentSystemPrompt(ctx.topic, ctx.aiPosition),
      isOpening
        ? "Write the opening statement for your side only."
        : `Recent transcript:\n${transcript}\n\nWrite the next opponent turn only.`,
    );
    if (!reply) {
      throw new Error("empty reply");
    }
    return reply;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "ai_unavailable", "The debate opponent is temporarily unavailable. Your argument was saved.");
  }
}

export async function generateFloorSpeech(
  ctx: TurnContext & { round: FloorRound; durationSeconds: number },
): Promise<string> {
  if (process.env.FORCE_AI_FAILURE === "1") {
    throw new HttpError(503, "ai_unavailable", "The speaker could not take the floor. You can retry.");
  }
  const transcript = ctx.messages
    .map((message) => `${message.speaker === "user" ? "User" : "Opponent"}: ${message.content}`)
    .join("\n");

  if (currentAiMode() === "mock") {
    return mockReply({ ...ctx, messages: ctx.round === "constructive" && ctx.messages.length === 0 ? [] : ctx.messages });
  }

  try {
    const reply = await completeText(
      floorSpeechPrompt(ctx.topic, ctx.aiPosition, ctx.round, ctx.durationSeconds),
      transcript ? `Transcript so far:\n${transcript}\n\nDeliver this speech only.` : "Deliver this speech only.",
    );
    if (!reply) throw new Error("empty reply");
    return reply;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "ai_unavailable", "The speaker could not take the floor. You can retry.");
  }
}

export async function generateAnalysis(ctx: AnalysisContext): Promise<AnalysisReport> {
  const speechMetrics = buildSpeechMetrics(ctx.speechTurns);
  const transcript = ctx.messages
    .map((message) => `${message.speaker === "user" ? "User" : "Opponent"}: ${message.content}`)
    .join("\n");

  const userPayload = `Topic: ${ctx.topic}
User position: ${ctx.userPosition}
Opponent position: ${ctx.aiPosition}
Transcript:
${transcript || "(empty)"}

Return JSON with keys: categoryScores, strengths, weaknesses, possibleFallacies, nextSteps.`;

  if (currentAiMode() === "mock") {
    return mockAnalysis(ctx, speechMetrics);
  }

  const attempt = async () => {
    const raw = await completeJson(analysisSystemPrompt(), userPayload);
    const parsed = analysisModelSchema.parse(JSON.parse(raw));
    return validateAnalysisDraft(parsed, speechMetrics, ctx.rubricVersion);
  };

  try {
    return await attempt();
  } catch (firstError) {
    console.error("analysis attempt 1 failed", firstError instanceof Error ? firstError.message : firstError);
    try {
      return await attempt();
    } catch (secondError) {
      console.error("analysis attempt 2 failed", secondError instanceof Error ? secondError.message : secondError);
      return mockAnalysis(ctx, speechMetrics);
    }
  }
}

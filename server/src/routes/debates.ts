import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { createDebateSchema, parseBody, startFloorSchema, turnSchema, yieldFloorSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateAnalysis, generateFloorSpeech, generateOpponentReply, opposite } from "../services/ai.js";
import { DEBATE_FLOORS, EXTENSION_SECONDS, floorAt, isUserFloor } from "../../../shared/floors.js";
import { serializeDetail, serializeMessage, serializeSession } from "../lib/serializers.js";
import { remainingSeconds } from "../../../shared/timer.js";
import { RUBRIC_VERSION, type DebatePosition, type Speaker } from "../../../shared/types.js";
import type { Prisma } from "@prisma/client";

function routeId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const debatesRouter = Router();
debatesRouter.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

async function ownedSession(userId: string, id: string) {
  const session = await prisma.debateSession.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { turnNumber: "asc" } }, analysis: true },
  });
  if (!session) {
    throw new HttpError(404, "not_found", "Debate session not found.");
  }
  return session;
}

debatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(createDebateSchema, req.body);
    const session = await prisma.debateSession.create({
      data: {
        userId: req.userId!,
        topic: body.topic,
        userPosition: body.userPosition,
        mode: body.mode,
        status: "active",
        startedAt: new Date(),
        durationSeconds: body.durationSeconds,
        floorIndex: -1,
        floorPhase: "briefing",
        rubricVersion: RUBRIC_VERSION,
      },
    });

    const created = await ownedSession(req.userId!, session.id);
    res.status(201).json({ data: serializeDetail(created) });
  }),
);

debatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const take = 20;
    const sessions = await prisma.debateSession.findMany({
      where: { userId: req.userId },
      include: { analysis: true },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = sessions.length > take;
    const page = hasMore ? sessions.slice(0, take) : sessions;
    res.json({
      data: {
        items: page.map(serializeSession),
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      },
    });
  }),
);

debatesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    res.json({ data: serializeDetail(session) });
  }),
);

debatesRouter.post(
  "/:id/floors/start",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(startFloorSchema, req.body);
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    if (session.status !== "active") {
      throw new HttpError(409, "session_closed", "This debate is no longer in session.");
    }
    const floor = floorAt(body.floorIndex);
    if (!floor) throw new HttpError(400, "invalid_input", "That speech is not on the order paper.");
    const expected = session.floorIndex + 1;
    if (body.floorIndex !== expected && !(session.floorIndex === body.floorIndex && session.floorPhase !== "handoff")) {
      throw new HttpError(409, "wrong_floor", "The chair has not called that speaker yet.");
    }

    const userPosition = session.userPosition as DebatePosition;
    const alreadySpoken =
      session.floorIndex === floor.index && session.messages.at(-1)?.speaker === (isUserFloor(userPosition, floor) ? "user" : "ai");
    if (!isUserFloor(userPosition, floor) && !alreadySpoken) {
      const messages = await prisma.debateMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { turnNumber: "asc" },
      });
      const speech = await generateFloorSpeech({
        topic: session.topic,
        userPosition,
        aiPosition: opposite(userPosition),
        messages: messages.map((message) => ({
          speaker: message.speaker as Speaker,
          content: message.content,
        })),
        round: floor.round,
        durationSeconds: session.durationSeconds,
      });
      await prisma.debateMessage.create({
        data: {
          sessionId: session.id,
          speaker: "ai",
          content: speech,
          turnNumber: messages.length + 1,
        },
      });
    }

    await prisma.debateSession.update({
      where: { id: session.id },
      data: {
        floorIndex: floor.index,
        floorPhase: "speaking",
        floorStartedAt: new Date(),
        extensionUsed: false,
        startedAt: session.startedAt ?? new Date(),
      },
    });

    res.json({ data: serializeDetail(await ownedSession(req.userId!, session.id)) });
  }),
);

debatesRouter.post(
  "/:id/floors/extend",
  asyncHandler(async (req, res) => {
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    const floor = floorAt(session.floorIndex);
    if (!floor || session.floorPhase !== "speaking") {
      throw new HttpError(409, "wrong_floor", "An extension is not available.");
    }
    if (session.extensionUsed) {
      throw new HttpError(409, "extension_used", "The thirty-second conclusion has already been granted.");
    }
    await prisma.debateSession.update({
      where: { id: session.id },
      data: {
        floorPhase: "extension",
        floorStartedAt: new Date(),
        extensionUsed: true,
      },
    });
    res.json({ data: serializeDetail(await ownedSession(req.userId!, session.id)) });
  }),
);

debatesRouter.post(
  "/:id/floors/yield",
  asyncHandler(async (req, res) => {
    const body = parseBody(yieldFloorSchema, req.body);
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    if (session.status !== "active") {
      throw new HttpError(409, "session_closed", "This debate is no longer in session.");
    }
    const floor = floorAt(session.floorIndex);
    if (!floor) throw new HttpError(409, "wrong_floor", "No speaker has the floor.");

    const userPosition = session.userPosition as DebatePosition;
    if (isUserFloor(userPosition, floor)) {
      const content = (body.content ?? "").trim() || "(The speaker yielded without a recorded argument.)";
      await prisma.debateMessage.create({
        data: {
          sessionId: session.id,
          speaker: "user",
          content,
          turnNumber: session.messages.length + 1,
          speakingDurationSeconds: body.speakingDurationSeconds ?? null,
        },
      });
    }

    const lastFloor = floor.index >= DEBATE_FLOORS.length - 1;
    await prisma.debateSession.update({
      where: { id: session.id },
      data: lastFloor
        ? { floorPhase: "closed", endedAt: new Date() }
        : { floorPhase: "handoff" },
    });

    res.json({ data: serializeDetail(await ownedSession(req.userId!, session.id)) });
  }),
);

debatesRouter.post(
  "/:id/turns",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(turnSchema, req.body);
    const session = await ownedSession(req.userId!, routeId(req.params.id));

    if (session.status !== "active") {
      throw new HttpError(409, "session_closed", "This debate is no longer accepting turns.");
    }

    if (remainingSeconds(session.startedAt, session.durationSeconds) <= 0) {
      throw new HttpError(409, "time_expired", "The timer has ended. Please complete the debate.");
    }

    const last = session.messages[session.messages.length - 1];
    let userMessage = last?.speaker === "user" ? last : null;

    if (body.content) {
      if (userMessage && last?.speaker === "user") {
        throw new HttpError(409, "awaiting_reply", "Wait for the opponent reply before sending another argument.");
      }
      if (session.messages.length >= 20) {
        throw new HttpError(409, "turn_limit", "This short session has reached its turn limit. Please finish the debate.");
      }
      userMessage = await prisma.debateMessage.create({
        data: {
          sessionId: session.id,
          speaker: "user",
          content: body.content,
          turnNumber: session.messages.length + 1,
          speakingDurationSeconds: body.speakingDurationSeconds ?? null,
        },
      });
    } else if (!userMessage && session.messages.length > 0) {
      throw new HttpError(400, "invalid_input", "Enter an argument of at least 10 characters.");
    }

    const messages = await prisma.debateMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { turnNumber: "asc" },
    });

    try {
      const reply = await generateOpponentReply({
        topic: session.topic,
        userPosition: session.userPosition as DebatePosition,
        aiPosition: opposite(session.userPosition as DebatePosition),
        messages: messages.map((message) => ({
          speaker: message.speaker as Speaker,
          content: message.content,
        })),
      });

      const aiMessage = await prisma.debateMessage.create({
        data: {
          sessionId: session.id,
          speaker: "ai",
          content: reply,
          turnNumber: messages.length + 1,
        },
      });

      res.json({
        data: {
          userTurn: userMessage ? serializeMessage(userMessage) : null,
          aiTurn: serializeMessage(aiMessage),
        },
      });
    } catch (error) {
      res.status(503).json({
        error: {
          code: "ai_unavailable",
          message:
            error instanceof HttpError
              ? error.message
              : "The debate opponent is temporarily unavailable. Your argument was saved.",
        },
        data: {
          userTurn: userMessage ? serializeMessage(userMessage) : null,
          aiTurn: null,
        },
      });
    }
  }),
);

debatesRouter.post(
  "/:id/complete",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    const force = Boolean((req.body as { force?: boolean } | undefined)?.force);
    const hasUserTurn = session.messages.some((message) => message.speaker === "user");
    if (!hasUserTurn && !force) {
      throw new HttpError(
        409,
        "no_user_turn",
        "The chair cannot close the house until you have taken at least one speech.",
      );
    }

    if (session.status === "analyzed" && session.analysis) {
      res.json({ data: serializeDetail(session) });
      return;
    }

    if (session.status === "active" || session.status === "completed" || session.status === "failed") {
      await prisma.debateSession.update({
        where: { id: session.id },
        data: {
          status: "analysis_pending",
          endedAt: session.endedAt ?? new Date(),
        },
      });
    }

    const messages = await prisma.debateMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { turnNumber: "asc" },
    });

    try {
      const report = await generateAnalysis({
        topic: session.topic,
        userPosition: session.userPosition as DebatePosition,
        aiPosition: opposite(session.userPosition as DebatePosition),
        messages: messages.map((message) => ({
          speaker: message.speaker as Speaker,
          content: message.content,
        })),
        speechTurns: messages
          .filter((message) => message.speaker === "user")
          .map((message) => ({
            content: message.content,
            speakingDurationSeconds: message.speakingDurationSeconds,
          })),
        rubricVersion: session.rubricVersion,
      });

      const analysis = await prisma.debateAnalysis.upsert({
        where: { sessionId: session.id },
        update: {
          overallScore: report.overallScore,
          categoryScores: jsonValue(report.categoryScores),
          strengths: jsonValue(report.strengths),
          weaknesses: jsonValue(report.weaknesses),
          fallacies: jsonValue(report.possibleFallacies),
          recommendations: jsonValue(report.nextSteps),
          speechMetrics: jsonValue(report.speechMetrics),
        },
        create: {
          sessionId: session.id,
          overallScore: report.overallScore,
          categoryScores: jsonValue(report.categoryScores),
          strengths: jsonValue(report.strengths),
          weaknesses: jsonValue(report.weaknesses),
          fallacies: jsonValue(report.possibleFallacies),
          recommendations: jsonValue(report.nextSteps),
          speechMetrics: jsonValue(report.speechMetrics),
        },
      });

      const updated = await prisma.debateSession.update({
        where: { id: session.id },
        data: { status: "analyzed", endedAt: session.endedAt ?? new Date() },
        include: { messages: { orderBy: { turnNumber: "asc" } }, analysis: true },
      });

      void analysis;
      res.json({ data: serializeDetail(updated) });
    } catch (error) {
      console.error("analysis persist failed", error instanceof Error ? error.message : error);
      const failed = await prisma.debateSession.update({
        where: { id: session.id },
        data: { status: "failed", endedAt: session.endedAt ?? new Date() },
        include: { messages: { orderBy: { turnNumber: "asc" } }, analysis: true },
      });
      res.status(200).json({ data: serializeDetail(failed) });
    }
  }),
);

debatesRouter.get(
  "/:id/analysis",
  asyncHandler(async (req, res) => {
    const session = await ownedSession(req.userId!, routeId(req.params.id));
    res.json({
      data: {
        status: session.status,
        analysis: session.analysis
          ? {
              ...serializeDetail(session).analysis,
            }
          : null,
      },
    });
  }),
);

debatesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await prisma.debateSession.findFirst({
      where: { id: routeId(req.params.id), userId: req.userId },
    });
    if (!session) {
      throw new HttpError(404, "not_found", "Debate session not found.");
    }
    await prisma.debateSession.delete({ where: { id: session.id } });
    res.json({ data: { ok: true } });
  }),
);

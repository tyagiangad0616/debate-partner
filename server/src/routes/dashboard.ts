import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { serializeSession } from "../lib/serializers.js";
import { roundForDisplay } from "../../../shared/scores.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const sessions = await prisma.debateSession.findMany({
      where: { userId: req.userId, analysis: { isNot: null } },
      include: { analysis: true },
      orderBy: { startedAt: "asc" },
    });

    const scores = sessions
      .map((session) => session.analysis?.overallScore)
      .filter((value): value is number => typeof value === "number");

    const averageScore =
      scores.length > 0 ? roundForDisplay(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;

    const trend = sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt?.toISOString() ?? session.createdAt.toISOString(),
      topic: session.topic,
      overallScore: session.analysis ? roundForDisplay(session.analysis.overallScore) : null,
      rubricVersion: session.rubricVersion,
    }));

    const recent = await prisma.debateSession.findMany({
      where: { userId: req.userId },
      include: { analysis: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    const active = await prisma.debateSession.findFirst({
      where: { userId: req.userId, status: "active" },
      include: { analysis: true },
      orderBy: { startedAt: "desc" },
    });

    res.json({
      data: {
        totalCompleted: scores.length,
        totalSessions: await prisma.debateSession.count({ where: { userId: req.userId } }),
        averageScore,
        sampleCount: scores.length,
        trend,
        recent: recent.map(serializeSession),
        active: active ? serializeSession(active) : null,
      },
    });
  }),
);

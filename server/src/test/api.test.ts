import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const app = createApp();

async function register(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({
    displayName: "Test Student",
    email,
    password: "password123",
  });
  expect(response.status).toBe(201);
  return agent;
}

describe("API acceptance paths", () => {
  afterEach(async () => {
    delete process.env.FORCE_AI_FAILURE;
    await prisma.debateAnalysis.deleteMany();
    await prisma.debateMessage.deleteMany();
    await prisma.debateSession.deleteMany();
    await prisma.user.deleteMany();
  });

  it("registers, authenticates, and returns the current profile", async () => {
    const agent = await register("one@example.com");
    const me = await agent.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("one@example.com");
  });

  it("creates a proposition session and assigns the opposite AI side through later replies", async () => {
    const agent = await register("two@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should university education be free?",
      userPosition: "proposition",
      mode: "text",
      durationSeconds: 120,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.userPosition).toBe("proposition");
    expect(created.body.data.status).toBe("active");
    expect(created.body.data.floorPhase).toBe("briefing");
    expect(created.body.data.messages).toHaveLength(0);
  });

  it("does not analyse a debate until the user has sent an argument", async () => {
    const agent = await register("noturn@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should university education be free?",
      userPosition: "proposition",
      mode: "text",
      durationSeconds: 120,
    });
    const completed = await agent.post(`/api/debates/${created.body.data.id}/complete`).send({});
    expect(completed.status).toBe(409);
    expect(completed.body.error.code).toBe("no_user_turn");
  });

  it("rejects an empty argument", async () => {
    const agent = await register("three@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should university education be free?",
      userPosition: "proposition",
      mode: "text",
      durationSeconds: 120,
    });
    const turn = await agent.post(`/api/debates/${created.body.data.id}/turns`).send({ content: "short" });
    expect(turn.status).toBe(400);
  });

  it("saves a user turn and returns an AI counterargument", async () => {
    const agent = await register("four@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should university education be free?",
      userPosition: "proposition",
      mode: "text",
      durationSeconds: 180,
    });
    const turn = await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
      content: "Free university education expands opportunity because cost is the main barrier for capable students.",
    });
    expect(turn.status).toBe(200);
    expect(turn.body.data.userTurn.speaker).toBe("user");
    expect(turn.body.data.aiTurn.speaker).toBe("ai");
    expect(turn.body.data.aiTurn.content.length).toBeGreaterThan(20);
  });

  it("preserves a user turn when opponent generation fails and does not duplicate it", async () => {
    process.env.FORCE_AI_FAILURE = "1";
    const agent = await register("five@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should university education be free?",
      userPosition: "opposition",
      mode: "text",
      durationSeconds: 180,
    });
    const first = await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
      content: "Public universities already receive substantial funding and adding more would crowd out other services.",
    });
    expect(first.status).toBe(503);
    expect(first.body.data.userTurn).toBeTruthy();
    expect(first.body.data.aiTurn).toBeNull();

    const detail = await agent.get(`/api/debates/${created.body.data.id}`);
    expect(detail.body.data.messages.filter((m: { speaker: string }) => m.speaker === "user")).toHaveLength(1);

    const duplicate = await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
      content: "Public universities already receive substantial funding and adding more would crowd out other services.",
    });
    expect(duplicate.status).toBe(409);

    const retry = await agent.post(`/api/debates/${created.body.data.id}/turns`).send({});
    expect(retry.status).toBe(503);
    const afterRetry = await agent.get(`/api/debates/${created.body.data.id}`);
    expect(afterRetry.body.data.messages.filter((m: { speaker: string }) => m.speaker === "user")).toHaveLength(1);
  });

  it("completes a session and stores a validated analysis report", async () => {
    const agent = await register("six@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should voting be compulsory in democratic countries?",
      userPosition: "proposition",
      mode: "text",
      durationSeconds: 180,
    });
    await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
      content: "Compulsory voting would raise turnout because civic duty is easier to meet when everyone must participate.",
    });
    const completed = await agent.post(`/api/debates/${created.body.data.id}/complete`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("analyzed");
    expect(completed.body.data.analysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(completed.body.data.analysis.overallScore).toBeLessThanOrEqual(10);
    expect(completed.body.data.analysis.categoryScores.logicalReasoning).toBeLessThanOrEqual(10);
  });

  it("prevents user A from reading user B's session", async () => {
    const agentA = await register("a@example.com");
    const created = await agentA.post("/api/debates").send({
      topic: "Is remote learning as effective as in-person education?",
      userPosition: "opposition",
      mode: "text",
      durationSeconds: 60,
    });
    const agentB = await register("b@example.com");
    const attempt = await agentB.get(`/api/debates/${created.body.data.id}`);
    expect(attempt.status).toBe(404);
  });

  it("deletes a session and updates dashboard aggregates", async () => {
    const agent = await register("seven@example.com");
    const created = await agent.post("/api/debates").send({
      topic: "Should AI-generated work be allowed in academic assignments?",
      userPosition: "opposition",
      mode: "text",
      durationSeconds: 180,
    });
    await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
      content: "Allowing unrestricted AI writing would hide whether the student can construct an argument at all.",
    });
    await agent.post(`/api/debates/${created.body.data.id}/complete`);
    const before = await agent.get("/api/dashboard/summary");
    expect(before.body.data.totalCompleted).toBe(1);

    const deleted = await agent.delete(`/api/debates/${created.body.data.id}`);
    expect(deleted.status).toBe(200);
    const after = await agent.get("/api/dashboard/summary");
    expect(after.body.data.totalCompleted).toBe(0);
    expect(after.body.data.totalSessions).toBe(0);
  });

  it("shows a trend after a second completed debate", async () => {
    const agent = await register("eight@example.com");
    for (const topic of [
      "Should university education be free?",
      "Is social media more harmful than beneficial for students?",
    ]) {
      const created = await agent.post("/api/debates").send({
        topic,
        userPosition: "proposition",
        mode: "text",
        durationSeconds: 180,
      });
      await agent.post(`/api/debates/${created.body.data.id}/turns`).send({
        content: "The policy follows because the current alternative leaves capable people excluded without a fair remedy.",
      });
      await agent.post(`/api/debates/${created.body.data.id}/complete`);
    }
    const summary = await agent.get("/api/dashboard/summary");
    expect(summary.body.data.totalCompleted).toBe(2);
    expect(summary.body.data.sampleCount).toBe(2);
    expect(summary.body.data.trend).toHaveLength(2);
  });
});

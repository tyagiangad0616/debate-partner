import { describe, expect, it } from "vitest";
import { buildSpeechMetrics, countFillerWords, countWords, wordsPerMinute } from "../../../shared/metrics.js";
import { aggregateOverall, isValidScore, roundForDisplay } from "../../../shared/scores.js";
import { formatClock, remainingSeconds } from "../../../shared/timer.js";
import { analysisModelSchema, validateAnalysisDraft } from "../lib/validation.js";

describe("speech metrics", () => {
  it("counts words and filler tokens", () => {
    expect(countWords("The motion should fall")).toBe(4);
    expect(countFillerWords("Um, the point is, uh, you know, complicated")).toBe(3);
  });

  it("omits words per minute without duration", () => {
    expect(wordsPerMinute(120, null)).toBeNull();
    expect(wordsPerMinute(120, 60)).toBe(120);
  });

  it("aggregates user turns", () => {
    const metrics = buildSpeechMetrics([
      { content: "Um this policy fails because costs rise.", speakingDurationSeconds: 30 },
    ]);
    expect(metrics.wordCount).toBeGreaterThan(0);
    expect(metrics.fillerWordCount).toBeGreaterThanOrEqual(1);
    expect(metrics.wordsPerMinute).not.toBeNull();
  });
});

describe("scores and timer", () => {
  it("uses the unweighted mean and rejects scores above 10", () => {
    expect(
      roundForDisplay(
        aggregateOverall({
          logicalReasoning: 8,
          rebuttalQuality: 7,
          evidenceAndSupport: 6,
          clarityAndStructure: 8,
          responsiveness: 7,
        }),
      ),
    ).toBe(7.2);
    expect(isValidScore(11)).toBe(false);
    expect(isValidScore(7)).toBe(true);
  });

  it("computes remaining debate time", () => {
    const started = new Date("2026-10-26T10:00:00.000Z");
    expect(remainingSeconds(started, 120, Date.parse("2026-10-26T10:01:00.000Z"))).toBe(60);
    expect(formatClock(75)).toBe("01:15");
  });
});

describe("analysis schema", () => {
  const valid = {
    categoryScores: {
      logicalReasoning: 8,
      rebuttalQuality: 7,
      evidenceAndSupport: 6,
      clarityAndStructure: 8,
      responsiveness: 7,
    },
    strengths: [{ title: "Clear claim", evidenceQuote: "Education should be free" }],
    weaknesses: [{ title: "Thin evidence", evidenceQuote: "It would help students" }],
    possibleFallacies: [],
    nextSteps: ["Add one concrete example"],
  };

  it("accepts a valid report and stores the aggregated overall score", () => {
    const parsed = analysisModelSchema.parse(valid);
    const report = validateAnalysisDraft(parsed, {
      wordCount: 12,
      speakingDurationSeconds: null,
      wordsPerMinute: null,
      fillerWordCount: 0,
      limitations: [],
    }, "v1");
    expect(report.overallScore).toBeCloseTo(7.2);
  });

  it("repairs an invalid score greater than 10 by clamping", () => {
    const report = validateAnalysisDraft(
      {
        ...valid,
        categoryScores: { ...valid.categoryScores, logicalReasoning: 11 },
      },
      {
        wordCount: 12,
        speakingDurationSeconds: null,
        wordsPerMinute: null,
        fillerWordCount: 0,
        limitations: [],
      },
      "v1",
    );
    expect(report.categoryScores.logicalReasoning).toBe(10);
  });
});

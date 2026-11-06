const SINGLE_FILLERS = new Set(["um", "uh", "er", "ah", "hmm", "uhm"]);

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function countFillerWords(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  const tokens = text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean);

  let count = 0;
  for (const token of tokens) {
    if (SINGLE_FILLERS.has(token)) count += 1;
  }

  count += (lower.match(/\byou know\b/g) ?? []).length;
  count += (lower.match(/\bi mean\b/g) ?? []).length;

  // Count "like" only in filler-like surroundings, not every comparison.
  count += (lower.match(/[,.!?]\s*like\s/g) ?? []).length;
  count += (lower.match(/\s like[,.!?]/g) ?? []).length;

  return count;
}

export function wordsPerMinute(
  wordCount: number,
  durationSeconds: number | null,
): number | null {
  if (!durationSeconds || durationSeconds <= 0 || wordCount <= 0) return null;
  return wordCount / (durationSeconds / 60);
}

export function buildSpeechMetrics(
  userTurns: Array<{ content: string; speakingDurationSeconds: number | null }>,
): {
  wordCount: number;
  speakingDurationSeconds: number | null;
  wordsPerMinute: number | null;
  fillerWordCount: number;
  limitations: string[];
} {
  const wordCount = userTurns.reduce((sum, turn) => sum + countWords(turn.content), 0);
  const fillerWordCount = userTurns.reduce(
    (sum, turn) => sum + countFillerWords(turn.content),
    0,
  );
  const timed = userTurns
    .map((turn) => turn.speakingDurationSeconds)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const speakingDurationSeconds =
    timed.length > 0 ? timed.reduce((sum, value) => sum + value, 0) : null;

  return {
    wordCount,
    speakingDurationSeconds,
    wordsPerMinute: wordsPerMinute(wordCount, speakingDurationSeconds),
    fillerWordCount,
    limitations: [
      "Metrics are derived from transcript text and optional client timing, not audio quality.",
      "Filler-word counts depend on recognition accuracy and conversational context.",
      "Words per minute is omitted when speaking duration is unavailable.",
    ],
  };
}

export function remainingSeconds(
  startedAt: string | Date | null,
  durationSeconds: number,
  now: number = Date.now(),
): number {
  if (!startedAt) return durationSeconds;
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  if (Number.isNaN(start)) return durationSeconds;
  const elapsed = Math.floor((now - start) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

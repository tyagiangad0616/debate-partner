import type { DebatePosition } from "./types.js";

export const EXTENSION_SECONDS = 30;

export type FloorRound = "constructive" | "rebuttal";
export type FloorPhase = "briefing" | "countdown" | "speaking" | "extension" | "closed";

export interface DebateFloor {
  index: number;
  side: DebatePosition;
  round: FloorRound;
  title: string;
  chairLine: string;
}

export const DEBATE_FLOORS: DebateFloor[] = [
  {
    index: 0,
    side: "proposition",
    round: "constructive",
    title: "Proposition constructive",
    chairLine: "The house will now hear the Proposition's constructive speech.",
  },
  {
    index: 1,
    side: "opposition",
    round: "constructive",
    title: "Opposition constructive",
    chairLine: "The house will now hear the Opposition's constructive speech.",
  },
  {
    index: 2,
    side: "proposition",
    round: "rebuttal",
    title: "Proposition rebuttal",
    chairLine: "Proposition may now rebut.",
  },
  {
    index: 3,
    side: "opposition",
    round: "rebuttal",
    title: "Opposition rebuttal",
    chairLine: "Opposition may now rebut and close.",
  },
];

export function floorAt(index: number): DebateFloor | null {
  return DEBATE_FLOORS[index] ?? null;
}

export function isUserFloor(userPosition: DebatePosition, floor: DebateFloor): boolean {
  return userPosition === floor.side;
}

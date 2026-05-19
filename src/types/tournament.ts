export type MatchScore = "2-0" | "2-1" | "1-2" | "0-2" | "1-0" | "0-1";

export const SCORE_TABLE: Record<MatchScore, { p1: number; p2: number }> = {
  "2-0": { p1: 6, p2: 0 },
  "2-1": { p1: 5, p2: 1 },
  "1-2": { p1: 1, p2: 5 },
  "0-2": { p1: 0, p2: 6 },
  "1-0": { p1: 3, p2: 0 },
  "0-1": { p1: 0, p2: 3 },
};

export const BYE_SCORE = 6;

export interface Player {
  id: string;
  name: string;
  hasByeBefore: boolean;
}

export interface Match {
  id: string;
  roundNumber: number;
  player1Id: string;
  player2Id: string | null;
  score: MatchScore | null;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  isComplete: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: string;
  players: Player[];
  totalRounds: number;
  rounds: Round[];
  currentRound: number;
  isFinished: boolean;
}

export interface StandingRow {
  player: Player;
  rank: number;
  score: number;
  omw: number;
  woScore: number;
  avomw: number;
  wins: number;
  losses: number;
  byes: number;
}

export const OMW_FLOOR = 1 / 3;

export function suggestRounds(playerCount: number): number {
  if (playerCount < 2) return 0;
  if (playerCount <= 8) return 3;
  if (playerCount <= 16) return 4;
  if (playerCount <= 32) return 5;
  return Math.ceil(Math.log2(playerCount));
}

export function isMatchComplete(match: Match): boolean {
  return match.player2Id === null || match.score !== null;
}

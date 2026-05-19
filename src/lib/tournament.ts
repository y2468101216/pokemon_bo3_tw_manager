import { v4 as uuidv4 } from "uuid";
import {
  type Match,
  type Player,
  type Round,
  type StandingRow,
  type Tournament,
  BYE_SCORE,
  OMW_FLOOR,
  SCORE_TABLE,
} from "@/types/tournament";

function isP1Winner(score: NonNullable<Match["score"]>): boolean {
  return score === "2-0" || score === "2-1" || score === "1-0";
}

export function calculatePlayerScore(
  playerId: string,
  tournament: Tournament,
): number {
  let total = 0;
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) {
        if (match.player1Id === playerId) total += BYE_SCORE;
        continue;
      }
      if (!match.score) continue;
      const points = SCORE_TABLE[match.score];
      if (match.player1Id === playerId) total += points.p1;
      else if (match.player2Id === playerId) total += points.p2;
    }
  }
  return total;
}

function getOpponentIds(playerId: string, tournament: Tournament): string[] {
  const out: string[] = [];
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) continue;
      if (match.score === null) continue;
      if (match.player1Id === playerId) out.push(match.player2Id);
      else if (match.player2Id === playerId) out.push(match.player1Id);
    }
  }
  return out;
}

function getPlayedMatchesFor(
  playerId: string,
  tournament: Tournament,
): { wins: number; played: number } {
  let wins = 0;
  let played = 0;
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) continue;
      if (!match.score) continue;
      const isP1 = match.player1Id === playerId;
      const isP2 = match.player2Id === playerId;
      if (!isP1 && !isP2) continue;
      played += 1;
      const p1Wins = isP1Winner(match.score);
      if ((isP1 && p1Wins) || (isP2 && !p1Wins)) wins += 1;
    }
  }
  return { wins, played };
}

function matchWinRate(playerId: string, tournament: Tournament): number {
  const { wins, played } = getPlayedMatchesFor(playerId, tournament);
  if (played === 0) return OMW_FLOOR;
  return Math.max(wins / played, OMW_FLOOR);
}

export function calculateOMW(
  playerId: string,
  tournament: Tournament,
): number {
  const opponents = getOpponentIds(playerId, tournament);
  if (opponents.length === 0) return 0;
  const sum = opponents.reduce(
    (acc, oid) => acc + matchWinRate(oid, tournament),
    0,
  );
  return sum / opponents.length;
}

export function calculateWOScore(
  playerId: string,
  tournament: Tournament,
): number {
  const opponents = getOpponentIds(playerId, tournament);
  return opponents.reduce(
    (acc, oid) => acc + calculatePlayerScore(oid, tournament),
    0,
  );
}

function opponentOMW(playerId: string, tournament: Tournament): number {
  return calculateOMW(playerId, tournament);
}

export function calculateAVOMW(
  playerId: string,
  tournament: Tournament,
): number {
  const opponents = getOpponentIds(playerId, tournament);
  if (opponents.length === 0) return 0;
  const sum = opponents.reduce(
    (acc, oid) => acc + opponentOMW(oid, tournament),
    0,
  );
  return sum / opponents.length;
}

export function getPlayerRecord(
  playerId: string,
  tournament: Tournament,
): { wins: number; losses: number; byes: number } {
  let wins = 0;
  let losses = 0;
  let byes = 0;
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) {
        if (match.player1Id === playerId) byes += 1;
        continue;
      }
      if (!match.score) continue;
      const isP1 = match.player1Id === playerId;
      const isP2 = match.player2Id === playerId;
      if (!isP1 && !isP2) continue;
      const p1Wins = isP1Winner(match.score);
      if ((isP1 && p1Wins) || (isP2 && !p1Wins)) wins += 1;
      else losses += 1;
    }
  }
  return { wins, losses, byes };
}

export function havePlayed(
  p1Id: string,
  p2Id: string,
  tournament: Tournament,
): boolean {
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) continue;
      const ids = [match.player1Id, match.player2Id];
      if (ids.includes(p1Id) && ids.includes(p2Id)) return true;
    }
  }
  return false;
}

function headToHeadWinner(
  aId: string,
  bId: string,
  tournament: Tournament,
): string | null {
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.player2Id === null) continue;
      if (!match.score) continue;
      const ids = [match.player1Id, match.player2Id];
      if (!ids.includes(aId) || !ids.includes(bId)) continue;
      const p1Wins = isP1Winner(match.score);
      return p1Wins ? match.player1Id : match.player2Id;
    }
  }
  return null;
}

export function getStandings(tournament: Tournament): StandingRow[] {
  const rows: Omit<StandingRow, "rank">[] = tournament.players.map(
    (player) => {
      const record = getPlayerRecord(player.id, tournament);
      return {
        player,
        score: calculatePlayerScore(player.id, tournament),
        omw: calculateOMW(player.id, tournament),
        woScore: calculateWOScore(player.id, tournament),
        avomw: calculateAVOMW(player.id, tournament),
        wins: record.wins,
        losses: record.losses,
        byes: record.byes,
      };
    },
  );

  rows.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.omw !== b.omw) return b.omw - a.omw;
    if (a.woScore !== b.woScore) return b.woScore - a.woScore;
    if (a.avomw !== b.avomw) return b.avomw - a.avomw;
    const winner = headToHeadWinner(a.player.id, b.player.id, tournament);
    if (winner === a.player.id) return -1;
    if (winner === b.player.id) return 1;
    return Math.random() - 0.5;
  });

  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export function assignBye(
  players: Player[],
  tournament: Tournament,
): Player | null {
  if (players.length === 0) return null;
  const withScore = players.map((p) => ({
    player: p,
    score: calculatePlayerScore(p.id, tournament),
  }));

  const notYetBye = withScore.filter((x) => !x.player.hasByeBefore);
  const pool = notYetBye.length > 0 ? notYetBye : withScore;

  const minScore = Math.min(...pool.map((x) => x.score));
  const candidates = pool.filter((x) => x.score === minScore);

  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx].player;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pairFirstRound(players: Player[], roundNumber: number): Match[] {
  const shuffled = shuffle(players);
  const matches: Match[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      id: uuidv4(),
      roundNumber,
      player1Id: shuffled[i].id,
      player2Id: shuffled[i + 1].id,
      score: null,
    });
  }
  return matches;
}

function pairByScore(
  players: Player[],
  tournament: Tournament,
  roundNumber: number,
): Match[] {
  const sorted = [...players].sort(
    (a, b) =>
      calculatePlayerScore(b.id, tournament) -
      calculatePlayerScore(a.id, tournament),
  );

  const remaining = [...sorted];
  const matches: Match[] = [];

  while (remaining.length >= 2) {
    const a = remaining.shift()!;
    let opponentIdx = 0;
    while (
      opponentIdx < remaining.length &&
      havePlayed(a.id, remaining[opponentIdx].id, tournament)
    ) {
      opponentIdx += 1;
    }
    if (opponentIdx >= remaining.length) opponentIdx = 0;
    const b = remaining.splice(opponentIdx, 1)[0];
    matches.push({
      id: uuidv4(),
      roundNumber,
      player1Id: a.id,
      player2Id: b.id,
      score: null,
    });
  }
  return matches;
}

export function generatePairings(
  tournament: Tournament,
  roundNumber: number,
): Match[] {
  const isFirstRound = roundNumber === 1;
  const pool = [...tournament.players];

  const matches: Match[] = [];
  let pairablePlayers = pool;

  if (pool.length % 2 === 1) {
    const byePlayer = assignBye(pool, tournament);
    if (byePlayer) {
      matches.push({
        id: uuidv4(),
        roundNumber,
        player1Id: byePlayer.id,
        player2Id: null,
        score: null,
      });
      pairablePlayers = pool.filter((p) => p.id !== byePlayer.id);
    }
  }

  const pairings = isFirstRound
    ? pairFirstRound(pairablePlayers, roundNumber)
    : pairByScore(pairablePlayers, tournament, roundNumber);

  return [...matches, ...pairings];
}

export function advanceToNextRound(tournament: Tournament): Tournament {
  const current = tournament.rounds[tournament.currentRound - 1];
  if (!current || !current.isComplete) return tournament;

  const byeIdsThisRound = current.matches
    .filter((m) => m.player2Id === null)
    .map((m) => m.player1Id);
  const playersAfter = tournament.players.map((p) =>
    byeIdsThisRound.includes(p.id) ? { ...p, hasByeBefore: true } : p,
  );

  if (tournament.currentRound >= tournament.totalRounds) {
    return {
      ...tournament,
      players: playersAfter,
      isFinished: true,
    };
  }

  const nextRoundNumber = tournament.currentRound + 1;
  const draft: Tournament = {
    ...tournament,
    players: playersAfter,
  };

  const nextMatches = generatePairings(draft, nextRoundNumber);
  const nextRound: Round = {
    roundNumber: nextRoundNumber,
    matches: nextMatches,
    isComplete: false,
  };

  return {
    ...draft,
    rounds: [...tournament.rounds, nextRound],
    currentRound: nextRoundNumber,
  };
}

export function createTournament(
  name: string,
  playerNames: string[],
  totalRounds: number,
): Tournament {
  const players: Player[] = playerNames.map((n) => ({
    id: uuidv4(),
    name: n,
    hasByeBefore: false,
  }));

  const draft: Tournament = {
    id: uuidv4(),
    name,
    createdAt: new Date().toISOString(),
    players,
    totalRounds,
    rounds: [],
    currentRound: 1,
    isFinished: false,
  };

  const firstMatches = generatePairings(draft, 1);
  const firstRound: Round = {
    roundNumber: 1,
    matches: firstMatches,
    isComplete: false,
  };

  return { ...draft, rounds: [firstRound] };
}

export function setMatchScore(
  tournament: Tournament,
  matchId: string,
  score: Match["score"],
): Tournament {
  const rounds = tournament.rounds.map((round) => {
    const matches = round.matches.map((m) =>
      m.id === matchId ? { ...m, score } : m,
    );
    const isComplete = matches.every(
      (m) => m.player2Id === null || m.score !== null,
    );
    return { ...round, matches, isComplete };
  });
  return { ...tournament, rounds };
}

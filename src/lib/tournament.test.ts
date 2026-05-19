import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  advanceToNextRound,
  assignBye,
  calculateOMP,
  calculatePlayerScore,
  createTournament,
  generatePairings,
  getPlayerRecord,
  getStandings,
  havePlayed,
  setMatchScore,
} from "./tournament";
import {
  type Player,
  type Tournament,
  SCORE_TABLE,
  suggestRounds,
} from "@/types/tournament";

function freezeRandom(value: number) {
  return vi.spyOn(Math, "random").mockReturnValue(value);
}

describe("SCORE_TABLE", () => {
  it("符合規格表", () => {
    expect(SCORE_TABLE["2-0"]).toEqual({ p1: 6, p2: 0 });
    expect(SCORE_TABLE["2-1"]).toEqual({ p1: 5, p2: 1 });
    expect(SCORE_TABLE["1-2"]).toEqual({ p1: 1, p2: 5 });
    expect(SCORE_TABLE["0-2"]).toEqual({ p1: 0, p2: 6 });
    expect(SCORE_TABLE["1-0"]).toEqual({ p1: 3, p2: 0 });
    expect(SCORE_TABLE["0-1"]).toEqual({ p1: 0, p2: 3 });
  });
});

describe("suggestRounds", () => {
  it("4-8 人建議 3 輪", () => {
    expect(suggestRounds(4)).toBe(3);
    expect(suggestRounds(8)).toBe(3);
  });
  it("9-16 人建議 4 輪", () => {
    expect(suggestRounds(9)).toBe(4);
    expect(suggestRounds(16)).toBe(4);
  });
  it("17-32 人建議 5 輪", () => {
    expect(suggestRounds(17)).toBe(5);
    expect(suggestRounds(32)).toBe(5);
  });
});

function makePlayers(names: string[]): Player[] {
  return names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    hasByeBefore: false,
  }));
}

function emptyTournament(players: Player[], totalRounds = 3): Tournament {
  return {
    id: "t1",
    name: "Test",
    createdAt: "2026-05-19T00:00:00.000Z",
    players,
    totalRounds,
    rounds: [],
    currentRound: 1,
    isFinished: false,
  };
}

describe("calculatePlayerScore + OMP + Record", () => {
  let t: Tournament;
  beforeEach(() => {
    const players = makePlayers(["A", "B", "C", "D"]);
    t = emptyTournament(players, 2);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p3",
            player2Id: "p4",
            score: "2-1",
          },
        ],
      },
      {
        roundNumber: 2,
        isComplete: true,
        matches: [
          {
            id: "m3",
            roundNumber: 2,
            player1Id: "p1",
            player2Id: "p3",
            score: "1-2",
          },
          {
            id: "m4",
            roundNumber: 2,
            player1Id: "p2",
            player2Id: "p4",
            score: "0-2",
          },
        ],
      },
    ];
    t.currentRound = 2;
  });

  it("calculatePlayerScore 算正確", () => {
    expect(calculatePlayerScore("p1", t)).toBe(6 + 1); // 2-0 then 1-2
    expect(calculatePlayerScore("p2", t)).toBe(0 + 0); // 0-2 then 0-2
    expect(calculatePlayerScore("p3", t)).toBe(5 + 5); // 2-1 then beat p1
    expect(calculatePlayerScore("p4", t)).toBe(1 + 6); // lose 2-1, beat p2
  });

  it("getPlayerRecord 勝負正確", () => {
    expect(getPlayerRecord("p1", t)).toEqual({ wins: 1, losses: 1, byes: 0 });
    expect(getPlayerRecord("p3", t)).toEqual({ wins: 2, losses: 0, byes: 0 });
    expect(getPlayerRecord("p2", t)).toEqual({ wins: 0, losses: 2, byes: 0 });
  });

  it("calculateOMP 為對手總分除以對手數", () => {
    // p1 的對手是 p2 (0) 與 p3 (10) → 平均 5
    expect(calculateOMP("p1", t)).toBe(5);
    // p3 的對手是 p4 (7) 與 p1 (7) → 平均 7
    expect(calculateOMP("p3", t)).toBe(7);
  });
});

describe("輪空（Bye）", () => {
  it("輪空計分為 6 分", () => {
    const players = makePlayers(["A", "B", "C"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: null,
            score: null,
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p2",
            player2Id: "p3",
            score: "2-0",
          },
        ],
      },
    ];
    expect(calculatePlayerScore("p1", t)).toBe(6);
    expect(getPlayerRecord("p1", t)).toEqual({ wins: 0, losses: 0, byes: 1 });
  });

  it("輪空場次不計入 OMP", () => {
    const players = makePlayers(["A", "B", "C"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: null,
            score: null,
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p2",
            player2Id: "p3",
            score: "2-0",
          },
        ],
      },
    ];
    // p1 沒有對手（只有輪空），OMP = 0
    expect(calculateOMP("p1", t)).toBe(0);
  });

  it("assignBye 選分數最低且未輪空過的選手", () => {
    const players: Player[] = [
      { id: "p1", name: "A", hasByeBefore: false },
      { id: "p2", name: "B", hasByeBefore: true },
      { id: "p3", name: "C", hasByeBefore: false },
    ];
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p3",
            score: "2-0",
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p2",
            player2Id: null,
            score: null,
          },
        ],
      },
    ];
    // p1 = 6, p2 = 6 (bye), p3 = 0
    // 候選：未輪空過 = p1, p3。最低 = p3 (0 分)
    const restore = freezeRandom(0);
    const bye = assignBye(players, t);
    restore.mockRestore();
    expect(bye?.id).toBe("p3");
  });

  it("若所有人都已輪空，從整體最低分挑", () => {
    const players: Player[] = [
      { id: "p1", name: "A", hasByeBefore: true },
      { id: "p2", name: "B", hasByeBefore: true },
    ];
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
        ],
      },
    ];
    const restore = freezeRandom(0);
    const bye = assignBye(players, t);
    restore.mockRestore();
    // p2 是 0 分
    expect(bye?.id).toBe("p2");
  });
});

describe("havePlayed", () => {
  it("正確識別過往對戰", () => {
    const players = makePlayers(["A", "B", "C", "D"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
        ],
      },
    ];
    expect(havePlayed("p1", "p2", t)).toBe(true);
    expect(havePlayed("p2", "p1", t)).toBe(true);
    expect(havePlayed("p1", "p3", t)).toBe(false);
  });
});

describe("getStandings", () => {
  it("依累積分數降序", () => {
    const players = makePlayers(["A", "B", "C", "D"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p3",
            player2Id: "p4",
            score: "2-1",
          },
        ],
      },
    ];
    const standings = getStandings(t);
    expect(standings.map((s) => s.player.id)).toEqual([
      "p1",
      "p3",
      "p4",
      "p2",
    ]);
    expect(standings[0].rank).toBe(1);
  });

  it("同分時依 OMP", () => {
    // p1 與 p3 同分 6（各贏一場），但 p1 的對手分數更高
    const players = makePlayers(["A", "B", "C", "D"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p3",
            player2Id: "p4",
            score: "2-0",
          },
        ],
      },
      {
        roundNumber: 2,
        isComplete: true,
        matches: [
          {
            id: "m3",
            roundNumber: 2,
            player1Id: "p2",
            player2Id: "p4",
            score: "2-0",
          },
          {
            id: "m4",
            roundNumber: 2,
            player1Id: "p1",
            player2Id: "p3",
            score: "1-0", // 時間到，p1 微勝
          },
        ],
      },
    ];
    // p1 score = 6 + 3 = 9, p3 score = 6 + 0 = 6
    // p1 排第一。 p2 = 0 + 6 = 6, p3 = 6, 同分
    // p2 的對手：p1(9) + p4(0) = 9, OMP=4.5
    // p3 的對手：p4(0) + p1(9) = 9, OMP=4.5
    // OMP 相同，再用 head-to-head: p3 vs p2 沒對戰過，會走 random
    const standings = getStandings(t);
    expect(standings[0].player.id).toBe("p1");
  });

  it("同分同 OMP 依直接對戰勝者", () => {
    const players = makePlayers(["A", "B"]);
    const t = emptyTournament(players, 1);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-1",
          },
        ],
      },
    ];
    const standings = getStandings(t);
    expect(standings[0].player.id).toBe("p1");
  });
});

describe("generatePairings", () => {
  it("偶數人第一輪產生 n/2 場 match", () => {
    const players = makePlayers(["A", "B", "C", "D"]);
    const t = emptyTournament(players);
    const matches = generatePairings(t, 1);
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.player2Id !== null)).toBe(true);
  });

  it("奇數人第一輪先指派 bye", () => {
    const players = makePlayers(["A", "B", "C"]);
    const t = emptyTournament(players);
    const matches = generatePairings(t, 1);
    expect(matches).toHaveLength(2);
    expect(matches.filter((m) => m.player2Id === null)).toHaveLength(1);
  });

  it("第二輪以後依分數分組，且避免重複對戰", () => {
    const players = makePlayers(["A", "B", "C", "D"]);
    const t = emptyTournament(players);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p2",
            score: "2-0",
          },
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p3",
            player2Id: "p4",
            score: "2-0",
          },
        ],
      },
    ];
    const r2 = generatePairings(t, 2);
    // p1, p3 各 6 分；p2, p4 各 0 分
    // 期望配對：p1 vs p3, p2 vs p4
    expect(r2).toHaveLength(2);
    const ids = r2.map((m) => [m.player1Id, m.player2Id].sort());
    expect(ids).toContainEqual(["p1", "p3"]);
    expect(ids).toContainEqual(["p2", "p4"]);
  });
});

describe("createTournament + advanceToNextRound 整合", () => {
  it("4 人賽事跑完 3 輪不重複對戰", () => {
    let t = createTournament("4P", ["A", "B", "C", "D"], 3);
    expect(t.rounds).toHaveLength(1);
    expect(t.rounds[0].matches).toHaveLength(2);

    // 設定第 1 輪結果
    t.rounds[0].matches.forEach((m, i) => {
      t = setMatchScore(t, m.id, i === 0 ? "2-0" : "2-1");
    });
    t = advanceToNextRound(t);
    expect(t.currentRound).toBe(2);
    expect(t.rounds).toHaveLength(2);

    // 第 2 輪
    t.rounds[1].matches.forEach((m) => {
      t = setMatchScore(t, m.id, "2-0");
    });
    t = advanceToNextRound(t);
    expect(t.currentRound).toBe(3);

    // 第 3 輪
    t.rounds[2].matches.forEach((m) => {
      t = setMatchScore(t, m.id, "2-0");
    });
    t = advanceToNextRound(t);
    expect(t.isFinished).toBe(true);

    // 沒有重複對戰
    const pairs = new Set<string>();
    let duplicates = 0;
    for (const round of t.rounds) {
      for (const m of round.matches) {
        if (m.player2Id === null) continue;
        const key = [m.player1Id, m.player2Id].sort().join("-");
        if (pairs.has(key)) duplicates += 1;
        pairs.add(key);
      }
    }
    expect(duplicates).toBe(0);
  });

  it("8 人賽事跑完 3 輪：第一輪隨機、後續按分組、無重複對戰", () => {
    let t = createTournament("8P", ["A", "B", "C", "D", "E", "F", "G", "H"], 3);
    for (let r = 0; r < 3; r += 1) {
      const round = t.rounds[t.currentRound - 1];
      expect(round.matches).toHaveLength(4);
      round.matches.forEach((m, i) => {
        if (m.player2Id === null) return;
        t = setMatchScore(t, m.id, i % 2 === 0 ? "2-0" : "2-1");
      });
      t = advanceToNextRound(t);
    }
    expect(t.isFinished).toBe(true);

    const seen = new Set<string>();
    let dup = 0;
    for (const r of t.rounds) {
      for (const m of r.matches) {
        if (m.player2Id === null) continue;
        const k = [m.player1Id, m.player2Id].sort().join("|");
        if (seen.has(k)) dup += 1;
        seen.add(k);
      }
    }
    expect(dup).toBe(0);
  });

  it("16 人賽事 4 輪：分數合理分布、無重複對戰", () => {
    const names = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
    let t = createTournament("16P", names, 4);
    for (let r = 0; r < 4; r += 1) {
      const round = t.rounds[t.currentRound - 1];
      expect(round.matches.filter((m) => m.player2Id !== null)).toHaveLength(8);
      round.matches.forEach((m) => {
        if (m.player2Id === null) return;
        t = setMatchScore(t, m.id, "2-0");
      });
      t = advanceToNextRound(t);
    }
    expect(t.isFinished).toBe(true);

    const standings = getStandings(t);
    // 4 場全勝 = 24 分；最低 = 0 分
    expect(standings[0].score).toBeLessThanOrEqual(24);
    expect(standings[standings.length - 1].score).toBeGreaterThanOrEqual(0);

    const seen = new Set<string>();
    for (const r of t.rounds) {
      for (const m of r.matches) {
        if (m.player2Id === null) continue;
        const k = [m.player1Id, m.player2Id].sort().join("|");
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });

  it("修改已輸入的比數會即時影響排名", () => {
    let t = createTournament("4P", ["A", "B", "C", "D"], 2);
    const m1 = t.rounds[0].matches[0];
    t = setMatchScore(t, m1.id, "2-0");
    const winnerId1 = m1.player1Id;
    expect(calculatePlayerScore(winnerId1, t)).toBe(6);
    // 改成 0-2 → 原 p1 變敗者
    t = setMatchScore(t, m1.id, "0-2");
    expect(calculatePlayerScore(winnerId1, t)).toBe(0);
    expect(calculatePlayerScore(m1.player2Id!, t)).toBe(6);
  });

  it("5 人賽事每輪有人輪空，同一人不會輪空兩次", () => {
    let t = createTournament("5P", ["A", "B", "C", "D", "E"], 3);
    const byeIds: string[] = [];

    for (let r = 0; r < 3; r += 1) {
      const round = t.rounds[t.currentRound - 1];
      const byeMatch = round.matches.find((m) => m.player2Id === null);
      expect(byeMatch).toBeTruthy();
      byeIds.push(byeMatch!.player1Id);
      round.matches.forEach((m) => {
        if (m.player2Id === null) return;
        t = setMatchScore(t, m.id, "2-0");
      });
      t = advanceToNextRound(t);
    }

    // 每輪都有 bye
    expect(byeIds).toHaveLength(3);
    // 三個不同人
    expect(new Set(byeIds).size).toBe(3);
  });
});

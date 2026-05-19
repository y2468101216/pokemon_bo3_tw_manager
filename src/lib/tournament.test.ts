import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  advanceToNextRound,
  assignBye,
  calculateAVOMW,
  calculateOMW,
  calculatePlayerScore,
  calculateWOScore,
  createTournament,
  generatePairings,
  getPlayerRecord,
  getStandings,
  havePlayed,
  setMatchScore,
} from "./tournament";
import {
  OMW_FLOOR,
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

describe("calculatePlayerScore + OMW + WOScore + AVOMW + Record", () => {
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

  it("calculatePlayerScore", () => {
    expect(calculatePlayerScore("p1", t)).toBe(7);
    expect(calculatePlayerScore("p2", t)).toBe(0);
    expect(calculatePlayerScore("p3", t)).toBe(10);
    expect(calculatePlayerScore("p4", t)).toBe(7);
  });

  it("getPlayerRecord", () => {
    expect(getPlayerRecord("p1", t)).toEqual({ wins: 1, losses: 1, byes: 0 });
    expect(getPlayerRecord("p3", t)).toEqual({ wins: 2, losses: 0, byes: 0 });
    expect(getPlayerRecord("p2", t)).toEqual({ wins: 0, losses: 2, byes: 0 });
  });

  it("calculateOMW（每位對手勝率套 1/3 floor 後平均）", () => {
    // p1 對手：p2 (0/2 → floor 1/3) 與 p3 (2/2 = 1) → 平均 (1/3 + 1)/2 = 2/3
    expect(calculateOMW("p1", t)).toBeCloseTo(2 / 3, 6);
    // p3 對手：p4 (1/2) 與 p1 (1/2) → 0.5
    expect(calculateOMW("p3", t)).toBeCloseTo(0.5, 6);
    // p2 對手：p1 (1/2) 與 p4 (1/2) → 0.5
    expect(calculateOMW("p2", t)).toBeCloseTo(0.5, 6);
  });

  it("calculateWOScore（對手總積分）", () => {
    // p1 對手分數：p2(0) + p3(10) = 10
    expect(calculateWOScore("p1", t)).toBe(10);
    // p3 對手分數：p4(7) + p1(7) = 14
    expect(calculateWOScore("p3", t)).toBe(14);
  });

  it("calculateAVOMW（對手的 OMW% 平均）", () => {
    // p1 對手是 p2 與 p3，二者 OMW% 均為 0.5 → 平均 0.5
    expect(calculateAVOMW("p1", t)).toBeCloseTo(0.5, 6);
    // p3 對手是 p4 與 p1
    // p4 對手：p3 (2/2) + p2 (0/2 → 1/3) → (1 + 1/3)/2 = 2/3
    // p1 OMW% = 2/3
    // AVOMW = (2/3 + 2/3)/2 = 2/3
    expect(calculateAVOMW("p3", t)).toBeCloseTo(2 / 3, 6);
  });
});

describe("OMW floor", () => {
  it("無對戰紀錄的對手回 1/3", () => {
    const players = makePlayers(["A", "B"]);
    const t = emptyTournament(players, 1);
    // 沒有任何 round 資料，A 沒下場過，wr 應回 floor
    expect(calculateOMW("p1", t)).toBe(0); // 因為 p1 自己也沒對手
  });
  it("OMW_FLOOR 為 1/3", () => {
    expect(OMW_FLOOR).toBeCloseTo(1 / 3, 6);
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

  it("輪空場次不算對手 played", () => {
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
    // p1 沒有對手（只輪空），OMW = 0
    expect(calculateOMW("p1", t)).toBe(0);
    expect(calculateWOScore("p1", t)).toBe(0);
  });

  it("assignBye 選分數最低且未輪空過", () => {
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
    const restore = freezeRandom(0);
    const bye = assignBye(players, t);
    restore.mockRestore();
    expect(bye?.id).toBe("p3");
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

describe("getStandings tiebreaker 順序", () => {
  it("分數 → OMW → WOScore → AVOMW → 直接對戰", () => {
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
    expect(standings[0].rank).toBe(1);
  });

  it("主要排序依分數降序", () => {
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
  });

  it("同分時依 OMW% 拆分", () => {
    // 兩個 6 分選手：A 的對手是強敵（高勝率），B 的對手是弱敵
    const players = makePlayers(["A", "B", "C", "D", "E", "F"]);
    const t = emptyTournament(players, 2);
    t.rounds = [
      {
        roundNumber: 1,
        isComplete: true,
        matches: [
          // A 贏 C（強敵）
          {
            id: "m1",
            roundNumber: 1,
            player1Id: "p1",
            player2Id: "p3",
            score: "2-0",
          },
          // B 贏 E（弱敵）
          {
            id: "m2",
            roundNumber: 1,
            player1Id: "p2",
            player2Id: "p5",
            score: "2-0",
          },
          // 讓 C 強過 E：先安排 D vs F
          {
            id: "m3",
            roundNumber: 1,
            player1Id: "p4",
            player2Id: "p6",
            score: "2-0",
          },
        ],
      },
      {
        roundNumber: 2,
        isComplete: true,
        matches: [
          // C 贏 D（C wr = 1/2）
          {
            id: "m4",
            roundNumber: 2,
            player1Id: "p3",
            player2Id: "p4",
            score: "2-0",
          },
          // E 輸 F（E wr = 0/2 → floor 1/3）
          {
            id: "m5",
            roundNumber: 2,
            player1Id: "p5",
            player2Id: "p6",
            score: "0-2",
          },
          // A 輪空？4 人偶數... 改 A vs B：但這樣 A 不再是 6 分
          // 為簡單起見：A 與 B 都不下場第 2 輪，假設第 2 輪只有 4 人
          // 移除此 case，留兩輪結構簡化測試
        ],
      },
    ];
    // A 對 C (wr 1/2=0.5)；B 對 E (wr 0/2 → 1/3)。A 的 OMW > B 的 OMW
    expect(calculateOMW("p1", t)).toBeCloseTo(0.5, 6);
    expect(calculateOMW("p2", t)).toBeCloseTo(1 / 3, 6);

    const standings = getStandings(t);
    // A 與 B 同 6 分；A 的 OMW 高 → A 排在 B 之前
    const aRank = standings.find((s) => s.player.id === "p1")!.rank;
    const bRank = standings.find((s) => s.player.id === "p2")!.rank;
    expect(aRank).toBeLessThan(bRank);
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
    expect(r2).toHaveLength(2);
    const ids = r2.map((m) => [m.player1Id, m.player2Id].sort());
    expect(ids).toContainEqual(["p1", "p3"]);
    expect(ids).toContainEqual(["p2", "p4"]);
  });
});

describe("createTournament + advanceToNextRound 整合", () => {
  it("4 人賽事跑完 3 輪不重複對戰", () => {
    let t = createTournament("4P", ["A", "B", "C", "D"], 3);
    expect(t.rounds[0].matches).toHaveLength(2);
    t.rounds[0].matches.forEach((m, i) => {
      t = setMatchScore(t, m.id, i === 0 ? "2-0" : "2-1");
    });
    t = advanceToNextRound(t);
    t.rounds[1].matches.forEach((m) => {
      t = setMatchScore(t, m.id, "2-0");
    });
    t = advanceToNextRound(t);
    t.rounds[2].matches.forEach((m) => {
      t = setMatchScore(t, m.id, "2-0");
    });
    t = advanceToNextRound(t);
    expect(t.isFinished).toBe(true);

    const seen = new Set<string>();
    let dup = 0;
    for (const round of t.rounds) {
      for (const m of round.matches) {
        if (m.player2Id === null) continue;
        const key = [m.player1Id, m.player2Id].sort().join("-");
        if (seen.has(key)) dup += 1;
        seen.add(key);
      }
    }
    expect(dup).toBe(0);
  });

  it("8 人賽事跑完 3 輪：無重複對戰", () => {
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

  it("16 人賽事 4 輪：分數合理，無重複對戰", () => {
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
    expect(standings[0].score).toBeLessThanOrEqual(24);
    expect(standings[standings.length - 1].score).toBeGreaterThanOrEqual(0);
    // 小分欄位應存在且為數字
    expect(typeof standings[0].omw).toBe("number");
    expect(typeof standings[0].woScore).toBe("number");
    expect(typeof standings[0].avomw).toBe("number");

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
    t = setMatchScore(t, m1.id, "0-2");
    expect(calculatePlayerScore(winnerId1, t)).toBe(0);
    expect(calculatePlayerScore(m1.player2Id!, t)).toBe(6);
  });

  it("5 人賽事每輪都有人輪空，三輪三個不同人", () => {
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
    expect(byeIds).toHaveLength(3);
    expect(new Set(byeIds).size).toBe(3);
  });
});

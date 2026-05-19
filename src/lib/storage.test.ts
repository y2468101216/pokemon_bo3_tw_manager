import { describe, expect, it } from "vitest";
import { exportTournamentJson, importTournamentJson } from "./storage";
import { advanceToNextRound, createTournament, setMatchScore } from "./tournament";

describe("JSON 匯出 / 匯入", () => {
  it("匯出後再匯入，賽事狀態完全一致", () => {
    let t = createTournament("Round-trip", ["A", "B", "C", "D"], 2);
    t.rounds[0].matches.forEach((m, i) => {
      t = setMatchScore(t, m.id, i === 0 ? "2-1" : "1-0");
    });
    t = advanceToNextRound(t);

    const raw = exportTournamentJson(t);
    const restored = importTournamentJson(raw);
    expect(restored).toEqual(t);
  });

  it("匯入非 Tournament 結構會丟出錯誤", () => {
    expect(() => importTournamentJson("{}")).toThrow();
    expect(() => importTournamentJson('{"foo":"bar"}')).toThrow();
  });
});

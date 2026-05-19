"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { Match, MatchScore, Tournament } from "@/types/tournament";
import {
  advanceToNextRound,
  getStandings,
  setMatchScore,
} from "@/lib/tournament";
import {
  deleteTournament,
  exportTournamentJson,
  loadTournament,
  saveTournament,
} from "@/lib/storage";

const SCORE_OPTIONS: MatchScore[] = ["2-0", "2-1", "1-2", "0-2", "1-0", "0-1"];

export default function TournamentPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-5xl mx-auto px-6 py-10 w-full">
          <p className="text-zinc-500">載入中…</p>
        </main>
      }
    >
      <TournamentView />
    </Suspense>
  );
}

function TournamentView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const t = loadTournament(id);
    setTournament(t);
    setLoading(false);
  }, [id]);

  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    tournament?.players.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [tournament]);

  const standings = useMemo(
    () => (tournament ? getStandings(tournament) : []),
    [tournament],
  );

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10 w-full">
        <p className="text-zinc-500">載入中…</p>
      </main>
    );
  }
  if (!tournament) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10 w-full">
        <p className="text-zinc-400 mb-4">找不到此賽事。</p>
        <Link href="/" className="text-zinc-300 hover:underline">
          ← 回首頁
        </Link>
      </main>
    );
  }

  const currentRound =
    tournament.rounds.find(
      (r) => r.roundNumber === tournament.currentRound,
    ) ?? null;
  const isLastRound = tournament.currentRound === tournament.totalRounds;
  const allRoundsComplete = tournament.rounds.every((r) => r.isComplete);

  function persist(next: Tournament) {
    setTournament(next);
    saveTournament(next);
  }

  function recordScore(matchId: string, score: MatchScore) {
    if (!tournament) return;
    const match = tournament.rounds
      .flatMap((r) => r.matches)
      .find((m) => m.id === matchId);
    if (match && match.score !== null) {
      if (!confirm("這場比賽已有比數，確定要修改？")) return;
    }
    persist(setMatchScore(tournament, matchId, score));
  }

  function clearScore(matchId: string) {
    if (!tournament) return;
    if (!confirm("確定要清除此場比數？")) return;
    persist(setMatchScore(tournament, matchId, null));
  }

  function nextRound() {
    if (!tournament) return;
    if (!allRoundsComplete) {
      alert("尚有比賽未輸入結果。");
      return;
    }
    persist(advanceToNextRound(tournament));
  }

  function finish() {
    if (!tournament) return;
    if (!allRoundsComplete) {
      alert("尚有比賽未輸入結果。");
      return;
    }
    persist(advanceToNextRound(tournament));
  }

  function exportJson() {
    if (!tournament) return;
    const blob = new Blob([exportTournamentJson(tournament)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tournament.name.replace(/[^\w\s.-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function removeTournament() {
    if (!tournament) return;
    if (!confirm(`確定刪除賽事「${tournament.name}」？`)) return;
    deleteTournament(tournament.id);
    router.push("/");
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 w-full space-y-8">
      {/* 賽事資訊區 */}
      <section className="border-b border-zinc-800 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="text-zinc-400 mt-1">
              第 {tournament.currentRound} 輪 / 共 {tournament.totalRounds} 輪 ·{" "}
              {tournament.players.length} 人 ·{" "}
              {tournament.isFinished ? (
                <span className="text-emerald-400">已完成</span>
              ) : (
                <span className="text-amber-400">進行中</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportJson}
              className="text-sm px-3 py-1 border border-zinc-700 rounded hover:bg-zinc-900"
            >
              匯出 JSON
            </button>
            <button
              onClick={removeTournament}
              className="text-sm px-3 py-1 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-700 rounded"
            >
              刪除賽事
            </button>
            <Link
              href="/"
              className="text-sm px-3 py-1 border border-zinc-700 rounded hover:bg-zinc-900"
            >
              回首頁
            </Link>
          </div>
        </div>
      </section>

      {/* 排名表 */}
      <section>
        <h2 className="text-xl font-semibold mb-3">排名</h2>
        <div className="overflow-x-auto border border-zinc-800 rounded">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">選手</th>
                <th className="px-3 py-2 text-right">勝-負</th>
                <th className="px-3 py-2 text-right">總分</th>
                <th className="px-3 py-2 text-right">OMP</th>
                <th className="px-3 py-2 text-right">輪空</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const medal =
                  row.rank === 1
                    ? "text-yellow-300 font-bold"
                    : row.rank === 2
                      ? "text-zinc-200 font-semibold"
                      : row.rank === 3
                        ? "text-amber-600 font-semibold"
                        : "";
                return (
                  <tr
                    key={row.player.id}
                    className="border-t border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <td className={`px-3 py-2 ${medal}`}>{row.rank}</td>
                    <td className={`px-3 py-2 ${medal}`}>{row.player.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.wins}-{row.losses}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {row.score}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                      {row.omp.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                      {row.byes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 目前輪次配對區 */}
      {!tournament.isFinished && currentRound && (
        <section>
          <h2 className="text-xl font-semibold mb-3">
            第 {currentRound.roundNumber} 輪配對
          </h2>
          <div className="space-y-2">
            {currentRound.matches.map((match, idx) => (
              <MatchRow
                key={match.id}
                tableNumber={idx + 1}
                match={match}
                playerNameMap={playerNameMap}
                onScore={recordScore}
                onClear={clearScore}
              />
            ))}
          </div>
          {currentRound.isComplete && (
            <div className="mt-6">
              {isLastRound ? (
                <button
                  onClick={finish}
                  className="px-5 py-2 bg-emerald-500 text-black font-semibold rounded hover:bg-emerald-400"
                >
                  完成賽事
                </button>
              ) : (
                <button
                  onClick={nextRound}
                  className="px-5 py-2 bg-white text-black font-semibold rounded hover:bg-zinc-200"
                >
                  進入第 {tournament.currentRound + 1} 輪
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {tournament.isFinished && (
        <section className="border border-emerald-700/40 bg-emerald-900/10 rounded p-4">
          <p className="text-emerald-300">
            🏆 賽事已完成。最終排名見上方排名表。
          </p>
        </section>
      )}

      {/* 歷史輪次區 */}
      {tournament.rounds.length > 1 && (
        <section>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm text-zinc-400 hover:text-white"
          >
            {showHistory ? "▼" : "▶"} 歷史輪次（
            {
              tournament.rounds.filter(
                (r) => r.roundNumber < tournament.currentRound,
              ).length
            }
            ）
          </button>
          {showHistory && (
            <div className="mt-4 space-y-6">
              {tournament.rounds
                .filter(
                  (r) =>
                    r.roundNumber <
                    (tournament.isFinished
                      ? tournament.currentRound + 1
                      : tournament.currentRound),
                )
                .map((round) => (
                  <div key={round.roundNumber}>
                    <h3 className="font-semibold mb-2 text-zinc-300">
                      第 {round.roundNumber} 輪
                    </h3>
                    <div className="space-y-1">
                      {round.matches.map((m, i) => (
                        <HistoryRow
                          key={m.id}
                          tableNumber={i + 1}
                          match={m}
                          playerNameMap={playerNameMap}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function MatchRow({
  tableNumber,
  match,
  playerNameMap,
  onScore,
  onClear,
}: {
  tableNumber: number;
  match: Match;
  playerNameMap: Map<string, string>;
  onScore: (matchId: string, score: MatchScore) => void;
  onClear: (matchId: string) => void;
}) {
  const isBye = match.player2Id === null;
  const p1Name = playerNameMap.get(match.player1Id) ?? "?";
  const p2Name = match.player2Id ? playerNameMap.get(match.player2Id) : null;

  return (
    <div className="border border-zinc-800 rounded p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-zinc-500 text-sm w-12 tabular-nums">
          桌 {tableNumber}
        </div>
        <div className="flex-1 min-w-[180px] font-medium">
          {p1Name}
          {isBye ? (
            <span className="text-zinc-400"> · 輪空</span>
          ) : (
            <>
              {" "}
              <span className="text-zinc-500">vs</span> {p2Name}
            </>
          )}
        </div>
        {isBye ? (
          <span className="text-sm text-emerald-400">Bye (2-0)</span>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {SCORE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onScore(match.id, s)}
                className={`px-2 py-1 text-sm border rounded tabular-nums ${
                  match.score === s
                    ? "bg-white text-black border-white font-semibold"
                    : "border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                {s}
              </button>
            ))}
            {match.score && (
              <button
                onClick={() => onClear(match.id)}
                className="px-2 py-1 text-xs text-zinc-500 hover:text-red-400"
              >
                清除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  tableNumber,
  match,
  playerNameMap,
}: {
  tableNumber: number;
  match: Match;
  playerNameMap: Map<string, string>;
}) {
  const isBye = match.player2Id === null;
  const p1Name = playerNameMap.get(match.player1Id) ?? "?";
  const p2Name = match.player2Id ? playerNameMap.get(match.player2Id) : null;
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400 px-2 py-1">
      <span className="w-12 text-zinc-600">桌 {tableNumber}</span>
      <span className="flex-1">
        {p1Name}
        {isBye ? " · 輪空" : ` vs ${p2Name}`}
      </span>
      <span className="tabular-nums font-mono text-zinc-300">
        {isBye ? "Bye" : (match.score ?? "—")}
      </span>
    </div>
  );
}

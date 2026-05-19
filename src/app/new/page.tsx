"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createTournament } from "@/lib/tournament";
import { saveTournament } from "@/lib/storage";
import { suggestRounds } from "@/types/tournament";

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [overrideRounds, setOverrideRounds] = useState<string>("");

  const playerNames = useMemo(
    () =>
      rosterText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [rosterText],
  );

  const suggested = suggestRounds(playerNames.length);
  const totalRounds =
    overrideRounds.trim() === ""
      ? suggested
      : Math.max(1, Number.parseInt(overrideRounds, 10) || suggested);

  const canSubmit = name.trim().length > 0 && playerNames.length >= 4;
  const hasDuplicates =
    new Set(playerNames).size !== playerNames.length && playerNames.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (hasDuplicates) {
      alert("選手名單有重複，請修正後再送出。");
      return;
    }
    const t = createTournament(name.trim(), playerNames, totalRounds);
    saveTournament(t);
    router.push(`/tournament/?id=${t.id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 w-full">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← 回首頁
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">建立新賽事</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">賽事名稱</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded focus:outline-none focus:border-zinc-500"
            placeholder="例：寶可夢 BO3 月例賽 2026/05"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            選手名單（每行一個名字，至少 4 人）
          </label>
          <textarea
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded font-mono text-sm focus:outline-none focus:border-zinc-500"
            placeholder={"Alice\nBob\nCharlie\nDan"}
            required
          />
          <div className="mt-2 text-sm text-zinc-400">
            目前 {playerNames.length} 人
            {hasDuplicates && (
              <span className="text-red-400 ml-2">⚠ 名單有重複</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            總輪數（建議 {suggested || "—"} 輪，可手動覆蓋）
          </label>
          <input
            type="number"
            min={1}
            value={overrideRounds}
            onChange={(e) => setOverrideRounds(e.target.value)}
            className="w-32 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded focus:outline-none focus:border-zinc-500"
            placeholder={String(suggested || "")}
          />
          <span className="ml-3 text-sm text-zinc-400">
            將進行 {totalRounds || 0} 輪
          </span>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2 bg-white text-black font-semibold rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200"
          >
            建立並開始第 1 輪
          </button>
        </div>
      </form>
    </main>
  );
}

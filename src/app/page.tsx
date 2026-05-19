"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Tournament } from "@/types/tournament";
import {
  deleteTournament,
  importTournamentJson,
  loadAllTournaments,
  saveTournament,
} from "@/lib/storage";

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTournaments(loadAllTournaments());
    setMounted(true);
  }, []);

  function refresh() {
    setTournaments(loadAllTournaments());
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`確定要刪除賽事「${name}」？此操作無法復原。`)) return;
    deleteTournament(id);
    refresh();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const t = importTournamentJson(text);
      saveTournament(t);
      refresh();
    } catch (err) {
      alert("匯入失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 w-full">
      <h1 className="text-3xl font-bold mb-2">BO3 瑞士輪賽事管理</h1>
      <p className="text-zinc-400 mb-8">純前端工具，資料儲存於瀏覽器 localStorage</p>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/new"
          className="px-4 py-2 bg-white text-black font-semibold rounded hover:bg-zinc-200"
        >
          建立新賽事
        </Link>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 border border-zinc-700 rounded hover:bg-zinc-900"
        >
          匯入 JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">已存賽事</h2>
      {!mounted ? (
        <p className="text-zinc-500">載入中…</p>
      ) : tournaments.length === 0 ? (
        <p className="text-zinc-500">尚無賽事。點擊「建立新賽事」開始。</p>
      ) : (
        <ul className="space-y-3">
          {tournaments.map((t) => {
            const status = t.isFinished ? "已完成" : "進行中";
            return (
              <li
                key={t.id}
                className="border border-zinc-800 rounded p-4 flex items-center justify-between gap-4"
              >
                <Link
                  href={`/tournament/?id=${t.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <div className="font-semibold group-hover:underline truncate">
                    {t.name}
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">
                    {t.players.length} 人 · 第 {t.currentRound} / {t.totalRounds} 輪 ·{" "}
                    <span
                      className={
                        t.isFinished ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {status}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="text-sm px-3 py-1 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-700 rounded"
                >
                  刪除
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

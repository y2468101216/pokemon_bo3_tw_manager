import type { Tournament } from "@/types/tournament";

const KEY_PREFIX = "swiss-tournament:";
const INDEX_KEY = "swiss-tournament:index";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readIndex(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.warn("localStorage 已滿，無法寫入索引");
    } else {
      throw err;
    }
  }
}

export function loadAllTournaments(): Tournament[] {
  if (!isBrowser()) return [];
  const ids = readIndex();
  const list: Tournament[] = [];
  for (const id of ids) {
    const t = loadTournament(id);
    if (t) list.push(t);
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return list;
}

export function loadTournament(id: string): Tournament | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as Tournament;
  } catch {
    return null;
  }
}

export function saveTournament(tournament: Tournament): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      KEY_PREFIX + tournament.id,
      JSON.stringify(tournament),
    );
    const ids = readIndex();
    if (!ids.includes(tournament.id)) {
      ids.push(tournament.id);
      writeIndex(ids);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      alert("瀏覽器儲存空間已滿，請刪除舊賽事後再試。");
    } else {
      throw err;
    }
  }
}

export function deleteTournament(id: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + id);
    const ids = readIndex().filter((x) => x !== id);
    writeIndex(ids);
  } catch {
    // ignore
  }
}

export function exportTournamentJson(tournament: Tournament): string {
  return JSON.stringify(tournament, null, 2);
}

export function importTournamentJson(raw: string): Tournament {
  const parsed = JSON.parse(raw) as Tournament;
  if (
    typeof parsed?.id !== "string" ||
    typeof parsed?.name !== "string" ||
    !Array.isArray(parsed?.players) ||
    !Array.isArray(parsed?.rounds)
  ) {
    throw new Error("JSON 格式不符合 Tournament 結構");
  }
  return parsed;
}

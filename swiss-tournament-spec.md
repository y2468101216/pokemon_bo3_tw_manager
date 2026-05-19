# BO3 瑞士輪賽事管理工具 — 規格文件

## 專案概述

純前端 Web 應用，用於辦理 8-32 人規模的 TCG/桌遊 BO3 瑞士輪賽事。完全在瀏覽器運行，資料存於 localStorage，可離線使用，可部署到 Vercel。

## 技術棧

- **框架**：Next.js 14（App Router）
- **語言**：TypeScript（strict mode）
- **樣式**：Tailwind CSS
- **狀態管理**：React useState + Context（或 Zustand，由實作者決定）
- **儲存**：localStorage（賽事資料 JSON 序列化）
- **部署目標**：Vercel（靜態匯出亦可）

## 設計原則

- **UI 風格**：黑底簡約，功能優先，不需華麗動效
- **離線優先**：所有運算在前端完成，不依賴後端 API
- **資料可攜**：賽事可匯出 JSON、可從 JSON 還原

---

## 核心規則：BO3 瑞士輪計分

### 計分表（單場 Match）

每場 Match 採 BO3（三戰兩勝），結果有六種可能：

| 比數 | 勝者得分 | 敗者得分 | 情境 |
|------|---------|---------|------|
| 2-0  | 6       | 0       | 完勝 |
| 2-1  | 5       | 1       | 險勝 |
| 1-2  | 1       | 5       | 險敗 |
| 0-2  | 0       | 6       | 完敗 |
| 1-0  | 3       | 0       | 時間到，勝者多 1 局 |
| 0-1  | 0       | 3       | 時間到，敗者多 1 局 |

**注意**：
- 沒有 1-1 平手機制，所有 Match 必須分出勝負
- 1-0 / 0-1 是時間到的情境（現實計時器處理，工具只負責記分）
- 不需要記錄每局誰先手後手

### 輪空（Bye）

- 當該輪選手數為奇數時，需指定一人輪空
- 輪空計分：**2-0（6 分）給輪空者**
- 輪空指派規則：
  - 同一選手不可輪空兩次
  - 應從**當前積分最低**的選手中挑選（最低分組裡選一個尚未輪空過的）
  - 若所有人都已輪空過（理論上不會在 32 人以下發生），則從整體最低分挑

### 配對演算法（瑞士輪）

**第一輪**：
- 隨機配對（不需要種子機制）
- 若奇數人，先指派輪空，再對剩下的人隨機配對

**第二輪以後**：
1. 按累積分數由高到低排序所有選手
2. 若奇數人，依「輪空指派規則」先指派輪空者
3. 將剩餘選手按分數分組（同分為一組）
4. 從最高分組開始，依序配對：
   - 取組內第一人 vs 第二人、第三人 vs 第四人……
   - 若該配對的兩人**先前已對戰過**，往下一個未配對選手交換
   - 若同分組人數為奇數，最後一人併入下一分組繼續配對
5. 若窮舉後仍無法避免重複對戰（極端情況），允許重複對戰並標記提醒

**演算法用貪心法即可**，32 人以下不需要 Blossom 等最佳化演算法。

### 排名與 Tiebreaker

主要排序：**累積分數（Match Points）由高到低**

同分時依序套用 tiebreaker：
1. **對手平均分（OMP, Opponent Match Points 平均）**：你所有對手得分加總 ÷ 對手數
2. **直接對戰勝負**：若同分選手之間有過對戰，勝者排前面
3. **隨機**（最終 fallback）

輪空場次不計入對手平均分的計算（對手不存在）。

---

## 資料結構（TypeScript）

```typescript
// 比數
type MatchScore = '2-0' | '2-1' | '1-2' | '0-2' | '1-0' | '0-1';

// 選手
interface Player {
  id: string;           // UUID
  name: string;
  hasByeBefore: boolean; // 是否已輪空過
}

// 單場對戰
interface Match {
  id: string;
  roundNumber: number;
  player1Id: string;
  player2Id: string | null; // null 代表輪空
  score: MatchScore | null; // null 代表尚未輸入結果
}

// 輪次
interface Round {
  roundNumber: number;
  matches: Match[];
  isComplete: boolean; // 所有 match 都有結果才算完成
}

// 賽事
interface Tournament {
  id: string;
  name: string;
  createdAt: string;     // ISO timestamp
  players: Player[];
  totalRounds: number;   // 預設輪數
  rounds: Round[];
  currentRound: number;  // 目前進行中的輪次（1-based）
  isFinished: boolean;
}

// 計分函式參考
const SCORE_TABLE: Record<MatchScore, { p1: number; p2: number }> = {
  '2-0': { p1: 6, p2: 0 },
  '2-1': { p1: 5, p2: 1 },
  '1-2': { p1: 1, p2: 5 },
  '0-2': { p1: 0, p2: 6 },
  '1-0': { p1: 3, p2: 0 },
  '0-1': { p1: 0, p2: 3 },
};
```

### 預設輪數建議

按選手數自動建議：
- 4-8 人：3 輪
- 9-16 人：4 輪
- 17-32 人：5 輪

公式：`Math.ceil(Math.log2(playerCount))`

使用者可手動覆蓋。

---

## 頁面與功能

### 1. 首頁 `/`

- 顯示「建立新賽事」按鈕
- 列出 localStorage 中已存在的賽事清單（按建立時間倒序）
- 每個賽事項目顯示：賽事名、選手數、進度（X/Y 輪）、狀態（進行中/已完成）
- 可刪除賽事（需確認）
- 可匯入 JSON 還原賽事

### 2. 建立賽事頁 `/new`

表單欄位：
- 賽事名稱（必填）
- 選手名單（每行一個名字，至少 4 人）
- 總輪數（自動建議，可手動覆蓋）

提交後建立賽事並導向 `/tournament/[id]`。

### 3. 賽事主頁 `/tournament/[id]`

頁面布局（從上到下）：

1. **賽事資訊區**
   - 賽事名稱
   - 進度：`第 X 輪 / 共 Y 輪`
   - 按鈕：匯出 JSON、刪除賽事、回首頁

2. **排名表**
   - 欄位：排名、選手名、勝-負（戰績）、總分、OMP、輪空次數
   - 按排名排序，視覺上突出前 3 名

3. **目前輪次配對區**
   - 顯示當前輪所有 match
   - 每個 match 顯示：桌號、選手 1 vs 選手 2、結果輸入按鈕（六個比數選項 + 「未完成」狀態）
   - 輪空 match 自動顯示為已完成，標示「Bye (2-0)」
   - 所有 match 完成後，顯示「進入下一輪」按鈕

4. **歷史輪次區**（可摺疊）
   - 顯示已完成的輪次配對與結果（唯讀）

5. **完成賽事按鈕**（最後一輪完成後出現）
   - 點擊後將 `isFinished` 設為 true，顯示最終排名

### 4. 互動細節

- 輸入比數：六個按鈕一字排開（2-0 / 2-1 / 1-2 / 0-2 / 1-0 / 0-1），點擊後立即儲存
- 可修改已輸入的比數（防誤觸需二次確認）
- 每次資料變動立即寫入 localStorage
- 排名表即時更新

---

## 核心函式規格

實作者請至少實作以下函式（建議放在 `lib/tournament.ts`）：

```typescript
// 計算選手目前分數
function calculatePlayerScore(playerId: string, tournament: Tournament): number;

// 計算選手 OMP
function calculateOMP(playerId: string, tournament: Tournament): number;

// 取得選手戰績（勝-負）
function getPlayerRecord(playerId: string, tournament: Tournament): { wins: number; losses: number };

// 取得排名表
function getStandings(tournament: Tournament): Array<{
  player: Player;
  rank: number;
  score: number;
  omp: number;
  wins: number;
  losses: number;
  byes: number;
}>;

// 生成第 N 輪配對
function generatePairings(tournament: Tournament, roundNumber: number): Match[];

// 指派輪空者
function assignBye(players: Player[], tournament: Tournament): Player | null;

// 檢查兩人是否已對戰過
function havePlayed(p1Id: string, p2Id: string, tournament: Tournament): boolean;

// 完成當前輪次並進入下一輪
function advanceToNextRound(tournament: Tournament): Tournament;
```

---

## 測試案例

實作完成後請至少手動驗證以下情境：

1. **4 人賽事（3 輪）**：正常跑完，無重複配對
2. **5 人賽事（3 輪）**：每輪都有人輪空，且同一人不會輪空兩次
3. **8 人賽事（3 輪）**：第一輪隨機，第二輪後同分組配對
4. **16 人賽事（4 輪）**：分數分布合理，排名 tiebreaker 正確運作
5. **匯出再匯入**：JSON 還原後賽事狀態完全一致
6. **修改已輸入的比數**：排名表正確即時更新

---

## 不需要做的功能（範圍外）

明確排除以下功能，避免過度設計：

- ❌ 計時器（現實有實體計時器）
- ❌ 裁判手動調整配對（全自動）
- ❌ 多人協作 / 雲端同步
- ❌ 帳號系統
- ❌ 平手機制（規則明定無平手）
- ❌ 種子排序（第一輪純隨機）
- ❌ 淘汰賽階段（純瑞士輪）
- ❌ 桌號分配邏輯（單純按 match 順序編號 1, 2, 3...）

---

## 開發順序建議

1. 建立 Next.js 專案骨架，設定 Tailwind 與黑底主題
2. 定義 TypeScript 型別（`types/tournament.ts`）
3. 實作核心邏輯函式（`lib/tournament.ts`），先寫單元測試
4. 實作 localStorage 持久層（`lib/storage.ts`）
5. 建立頁面：首頁 → 建立賽事 → 賽事主頁
6. 串接配對生成與比數輸入流程
7. 完成排名表與 tiebreaker 顯示
8. 加上匯入/匯出 JSON 功能
9. 手動測試上述測試案例
10. 部署到 Vercel

---

## 給實作 AI 的提示

- 配對演算法的邊界條件（奇數人、重複對戰、輪空指派）容易出錯，請寫單元測試覆蓋
- localStorage 操作要包 try-catch，並處理 QuotaExceededError
- 所有日期使用 ISO 8601 字串儲存，避免時區問題
- TypeScript 開 strict mode，禁用 any
- UI 元件用 Tailwind utility classes，不要拉 shadcn/ui 等重型函式庫（保持輕量）
- 字型用系統預設即可（`font-sans`），不需引入 Google Fonts

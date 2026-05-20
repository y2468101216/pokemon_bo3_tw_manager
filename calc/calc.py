"""
PTCG 賽制公平性蒙地卡羅模擬
================================

TPC（日本 6-5-3-1-0）vs TPCi（國際 3-1-0）對照模擬。

可調參數集中在頂部 CONFIG 區。直接執行：
    python ptcg_sim.py

需要：numpy

作者：Yun + Claude 討論衍生
"""

import random
from collections import defaultdict
import numpy as np
import json


# ============================================================
# CONFIG — 想調的參數都在這裡
# ============================================================

CONFIG = {
    # ---- 賽事規模 ----
    'n_players': 400,           # 報名人數
    'day1_rounds': 9,           # Day1 BO1 輪數
    'day2_rounds': 5,           # Day2 BO3 輪數
    'max_losses_to_qualify': 2, # Day1 幾敗以內晉級 Day2
    'top_cut': 8,               # 最終 Top Cut 名額

    # ---- 模擬次數 ----
    'n_sims': 4000,             # 重複幾場比賽

    # ---- 超時率情境（list，會逐一跑） ----
    # 每對 BO3 該局有多少機率「時間到沒打完」
    'timeout_scenarios': [0.0, 0.05, 0.15, 0.25, 0.40],

    # ---- 勝率設定 ----
    # 'uniform' = 全部 50/50（純制度測試）
    # 'skill'   = 每位玩家有隱藏實力分數，勝率由實力差決定
    'skill_mode': 'uniform',
    'skill_std': 0.3,           # skill 模式下實力分布的標準差（越大差距越極端）

    # ---- 規則設定 ----
    'rules_to_run': ['tpc', 'tpci'],  # 要跑哪幾套規則

    # ---- 隨機種子 ----
    'seed': 7777,               # 設 None 則每次跑都不同

    # ---- 輸出 ----
    'output_json': 'results.json',
    'print_js_format': True,    # 是否印出可貼進 HTML 的 JS 格式
}


# ============================================================
# 計分規則定義
# ============================================================

# TPC 規則（日本：6-5-3-1-0）
TPC_RULES = {
    'bye_score': 6,
    'score_2_0_win': 6, 'score_2_0_lose': 0,
    'score_2_1_win': 5, 'score_2_1_lose': 1,
    'score_1_0_win': 3, 'score_1_0_lose': 0,  # 時間到 1-0
    'day1_win': 3, 'day1_lose': 0,
}

# TPCi 規則（國際：3-1-0，MTG 標準）
TPCI_RULES = {
    'bye_score': 3,
    'score_2_0_win': 3, 'score_2_0_lose': 0,
    'score_2_1_win': 3, 'score_2_1_lose': 0,  # 贏就 3 分
    'score_timeout_each': 1,                  # 時間到雙方各 1 分
    'day1_win': 3, 'day1_lose': 0,
}


# ============================================================
# 配對演算法（瑞士制）
# ============================================================

def swiss_pairing(players_with_scores):
    """
    瑞士制配對：按分數分組，組內隨機配對。
    若總人數奇數，最低分組末位拿 Bye。
    
    回傳：(配對列表, Bye 玩家 id 或 None)
    """
    sorted_players = sorted(players_with_scores, key=lambda x: -x[1])
    bye_player = None
    if len(sorted_players) % 2 == 1:
        bye_player = sorted_players[-1][0]
        sorted_players = sorted_players[:-1]
    
    groups = defaultdict(list)
    for pid, score in sorted_players:
        groups[score].append(pid)
    
    pairings = []
    leftover = None
    for score in sorted(groups.keys(), reverse=True):
        group = groups[score][:]
        random.shuffle(group)
        if leftover is not None:
            pairings.append((leftover, group.pop(0)))
            leftover = None
        while len(group) >= 2:
            pairings.append((group.pop(0), group.pop(0)))
        if group:
            leftover = group[0]
    
    if leftover is not None:
        if bye_player is None:
            bye_player = leftover
        else:
            pairings.append((leftover, bye_player))
            bye_player = None
    
    return pairings, bye_player


# ============================================================
# 勝率模型
# ============================================================

def win_probability(p1_skill, p2_skill):
    """
    根據兩位玩家的實力分數計算 p1 獲勝機率。
    使用 logistic（類似 ELO）。
    """
    return 1.0 / (1.0 + np.exp(-(p1_skill - p2_skill)))


def init_skills(n_players, mode, std):
    """初始化每位玩家的實力分數。"""
    if mode == 'uniform':
        return np.zeros(n_players)  # 全部一樣 = 50/50
    elif mode == 'skill':
        return np.random.normal(0, std, n_players)
    else:
        raise ValueError(f"未知 skill_mode: {mode}")


# ============================================================
# 單場 BO1 / BO3 模擬
# ============================================================

def simulate_bo1(p1_skill, p2_skill):
    """單場 BO1，回傳贏家索引（0 或 1）。"""
    p = win_probability(p1_skill, p2_skill)
    return 0 if random.random() < p else 1


def simulate_bo3_tpc(p1_skill, p2_skill, p_timeout):
    """TPC 規則 BO3，回傳 (p1_分數, p2_分數)。"""
    if random.random() < p_timeout:
        # 時間到：隨機決定誰領先（依勝率加權）
        p_win = win_probability(p1_skill, p2_skill)
        if random.random() < p_win:
            return (TPC_RULES['score_1_0_win'], TPC_RULES['score_1_0_lose'])
        else:
            return (TPC_RULES['score_1_0_lose'], TPC_RULES['score_1_0_win'])
    
    p_win = win_probability(p1_skill, p2_skill)
    g1_p1_wins = random.random() < p_win
    g2_p1_wins = random.random() < p_win
    
    if g1_p1_wins == g2_p1_wins:
        # 2-0
        if g1_p1_wins:
            return (TPC_RULES['score_2_0_win'], TPC_RULES['score_2_0_lose'])
        else:
            return (TPC_RULES['score_2_0_lose'], TPC_RULES['score_2_0_win'])
    else:
        # 1-1 → 第三局
        g3_p1_wins = random.random() < p_win
        if g3_p1_wins:
            return (TPC_RULES['score_2_1_win'], TPC_RULES['score_2_1_lose'])
        else:
            return (TPC_RULES['score_2_1_lose'], TPC_RULES['score_2_1_win'])


def simulate_bo3_tpci(p1_skill, p2_skill, p_timeout):
    """TPCi 規則 BO3，回傳 (p1_分數, p2_分數)。"""
    if random.random() < p_timeout:
        # 時間到 = 平手
        s = TPCI_RULES['score_timeout_each']
        return (s, s)
    
    p_win = win_probability(p1_skill, p2_skill)
    g1_p1_wins = random.random() < p_win
    g2_p1_wins = random.random() < p_win
    
    if g1_p1_wins == g2_p1_wins:
        # 2-0
        if g1_p1_wins:
            return (TPCI_RULES['score_2_0_win'], TPCI_RULES['score_2_0_lose'])
        else:
            return (TPCI_RULES['score_2_0_lose'], TPCI_RULES['score_2_0_win'])
    else:
        # 1-1 → 第三局
        g3_p1_wins = random.random() < p_win
        if g3_p1_wins:
            return (TPCI_RULES['score_2_1_win'], TPCI_RULES['score_2_1_lose'])
        else:
            return (TPCI_RULES['score_2_1_lose'], TPCI_RULES['score_2_1_win'])


# ============================================================
# Day1 / Day2 模擬
# ============================================================

def simulate_day1(skills, n_rounds):
    """
    Day1 BO1 瑞士輪。
    回傳 [(player_id, score, losses)]
    """
    n = len(skills)
    scores = {i: 0 for i in range(n)}
    losses = {i: 0 for i in range(n)}
    
    for r in range(n_rounds):
        pws = [(pid, scores[pid]) for pid in range(n)]
        pairings, bye_player = swiss_pairing(pws)
        
        if bye_player is not None:
            scores[bye_player] += TPC_RULES['day1_win']  # TPC/TPCi Day1 一樣
        
        for p1, p2 in pairings:
            winner_idx = simulate_bo1(skills[p1], skills[p2])
            if winner_idx == 0:
                scores[p1] += TPC_RULES['day1_win']
                losses[p2] += 1
            else:
                scores[p2] += TPC_RULES['day1_win']
                losses[p1] += 1
    
    return [(pid, scores[pid], losses[pid]) for pid in range(n)]


def simulate_day2(qualifiers, skills, n_rounds, rule, p_timeout):
    """
    Day2 BO3 瑞士輪。
    qualifiers: [(player_id, day1_score)]
    回傳 (累積總分 dict, Bye 次數 dict)
    """
    total_scores = {pid: d1s for pid, d1s in qualifiers}
    day2_byes = {pid: 0 for pid, _ in qualifiers}
    
    if rule == 'tpc':
        bo3_fn = simulate_bo3_tpc
        bye_score = TPC_RULES['bye_score']
    elif rule == 'tpci':
        bo3_fn = simulate_bo3_tpci
        bye_score = TPCI_RULES['bye_score']
    else:
        raise ValueError(f"未知規則: {rule}")
    
    for r in range(n_rounds):
        pws = [(pid, total_scores[pid]) for pid in total_scores]
        pairings, bye_player = swiss_pairing(pws)
        
        if bye_player is not None:
            total_scores[bye_player] += bye_score
            day2_byes[bye_player] += 1
        
        for p1, p2 in pairings:
            s1, s2 = bo3_fn(skills[p1], skills[p2], p_timeout)
            total_scores[p1] += s1
            total_scores[p2] += s2
    
    return total_scores, day2_byes


# ============================================================
# 跑一整場賽事
# ============================================================

def run_one_tournament(config, rule, p_timeout):
    """跑一場完整賽事，回傳關鍵指標。"""
    n = config['n_players']
    skills = init_skills(n, config['skill_mode'], config['skill_std'])
    
    # Day1
    d1 = simulate_day1(skills, config['day1_rounds'])
    
    # 篩晉級者
    quals = [(pid, score) for pid, score, losses in d1 
             if losses <= config['max_losses_to_qualify']]
    quals.sort(key=lambda x: -x[1])
    
    if len(quals) == 0:
        return None  # 不應發生
    
    last_qual = quals[-1][0]
    first = max(d1, key=lambda x: x[1])[0]
    
    # Day2
    total_scores, byes = simulate_day2(
        quals, skills, config['day2_rounds'], rule, p_timeout
    )
    
    # Top Cut（同分隨機排序，沒模擬 tiebreaker）
    items = list(total_scores.items())
    random.shuffle(items)
    items.sort(key=lambda x: -x[1])
    top_cut_ids = {pid for pid, _ in items[:config['top_cut']]}
    
    return {
        'last_qual_top_cut': int(last_qual in top_cut_ids),
        'first_top_cut': int(first in top_cut_ids),
        'last_qual_byes': byes.get(last_qual, 0),
        'first_byes': byes.get(first, 0),
        'n_qual': len(quals),
        'last_qual_d2_gain': total_scores[last_qual] - quals[-1][1],
        'first_d2_gain': total_scores[first] - max(d1, key=lambda x: x[1])[1],
    }


# ============================================================
# 統計分析
# ============================================================

def analyze(config, rule, p_timeout):
    """跑 N 場賽事，回傳統計結果。"""
    results = []
    for _ in range(config['n_sims']):
        r = run_one_tournament(config, rule, p_timeout)
        if r is not None:
            results.append(r)
    
    n = len(results)
    first_top = np.mean([r['first_top_cut'] for r in results]) * 100
    last_top = np.mean([r['last_qual_top_cut'] for r in results]) * 100
    first_bye_rate = np.mean([r['first_byes'] > 0 for r in results]) * 100
    last_bye_rate = np.mean([r['last_qual_byes'] > 0 for r in results]) * 100
    first_d2_gain = np.mean([r['first_d2_gain'] for r in results])
    last_d2_gain = np.mean([r['last_qual_d2_gain'] for r in results])
    n_qual_avg = np.mean([r['n_qual'] for r in results])
    
    # 條件機率：拿到 Bye / 沒拿到 Bye 的 Top Cut 率
    with_bye = [r for r in results if r['last_qual_byes'] > 0]
    no_bye = [r for r in results if r['last_qual_byes'] == 0]
    
    wb = (np.mean([r['last_qual_top_cut'] for r in with_bye]) * 100 
          if with_bye else 0.0)
    nb = (np.mean([r['last_qual_top_cut'] for r in no_bye]) * 100 
          if no_bye else 0.0)
    
    return {
        'rule': rule,
        'p_timeout': p_timeout,
        'n_sims': n,
        'first_top_cut': round(float(first_top), 2),
        'last_top_cut': round(float(last_top), 2),
        'first_bye_rate': round(float(first_bye_rate), 2),
        'last_bye_rate': round(float(last_bye_rate), 2),
        'first_d2_gain': round(float(first_d2_gain), 2),
        'last_d2_gain': round(float(last_d2_gain), 2),
        'n_qual_avg': round(float(n_qual_avg), 1),
        'last_top_cut_with_bye': round(float(wb), 2),
        'last_top_cut_no_bye': round(float(nb), 2),
        'bye_advantage_pp': round(float(wb - nb), 2),
    }


# ============================================================
# 主流程
# ============================================================

def main(config=None):
    if config is None:
        config = CONFIG
    
    if config['seed'] is not None:
        random.seed(config['seed'])
        np.random.seed(config['seed'])
    
    print("=" * 70)
    print("PTCG 賽制公平性蒙地卡羅模擬")
    print("=" * 70)
    print(f"參賽人數     : {config['n_players']}")
    print(f"Day1 輪數    : {config['day1_rounds']} (BO1, ≤{config['max_losses_to_qualify']} 敗晉級)")
    print(f"Day2 輪數    : {config['day2_rounds']} (BO3)")
    print(f"Top Cut      : 前 {config['top_cut']} 名")
    print(f"勝率模式     : {config['skill_mode']}" +
          (f" (std={config['skill_std']})" if config['skill_mode'] == 'skill' else ""))
    print(f"模擬次數     : {config['n_sims']}")
    print(f"超時率情境   : {[f'{t*100:.0f}%' for t in config['timeout_scenarios']]}")
    print(f"規則         : {config['rules_to_run']}")
    print(f"隨機種子     : {config['seed']}")
    print("=" * 70)
    
    data = {rule: [] for rule in config['rules_to_run']}
    
    for p_to in config['timeout_scenarios']:
        for rule in config['rules_to_run']:
            print(f"\n  跑模擬 → 規則={rule.upper()}  超時率={p_to*100:.0f}%")
            result = analyze(config, rule, p_to)
            data[rule].append(result)
    
    # 印摘要表
    print("\n" + "=" * 70)
    print("摘要")
    print("=" * 70)
    print(f"\n{'規則':<6} {'超時率':<8} {'第一名Top':<12} {'末位Top':<12} "
          f"{'末位Bye率':<12} {'Bye紅利':<10}")
    print("-" * 70)
    for rule in config['rules_to_run']:
        for d in data[rule]:
            print(f"{rule.upper():<6} {d['p_timeout']*100:>5.0f}%   "
                  f"{d['first_top_cut']:>8.2f}%    "
                  f"{d['last_top_cut']:>8.2f}%    "
                  f"{d['last_bye_rate']:>8.2f}%    "
                  f"{d['bye_advantage_pp']:>+7.2f}pp")
        print()
    
    # 輸出 JSON
    with open(config['output_json'], 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"完整結果已存至 {config['output_json']}")
    
    # 印 JS 格式（給 HTML 用）
    if config['print_js_format']:
        print("\n" + "=" * 70)
        print("JS 格式（可貼進 HTML）")
        print("=" * 70)
        print("const DATA = {")
        for rule in config['rules_to_run']:
            key = 'pacs' if rule == 'tpc' else 'mtg'  # 對應 HTML 內部 key
            print(f"  {key}: [")
            for d in data[rule]:
                print(f"    {{p_timeout:{d['p_timeout']}, "
                      f"first_top8:{d['first_top_cut']}, "
                      f"last_top8:{d['last_top_cut']}, "
                      f"first_bye_rate:{d['first_bye_rate']}, "
                      f"last_bye_rate:{d['last_bye_rate']}, "
                      f"last_top8_with_bye:{d['last_top_cut_with_bye']}, "
                      f"last_top8_no_bye:{d['last_top_cut_no_bye']}, "
                      f"bye_advantage_pp:{d['bye_advantage_pp']}}},")
            print("  ],")
        print("};")
    
    return data


if __name__ == '__main__':
    main()
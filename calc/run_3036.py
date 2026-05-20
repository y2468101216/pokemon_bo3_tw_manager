"""跑 3036 人版本，其餘參數沿用 calc.py 的 CONFIG。"""
import time
from calc import CONFIG, main

start = time.time()
config = dict(CONFIG)
config['n_players'] = 3036
config['output_json'] = 'results_3036.json'

main(config)

print(f"\n總耗時: {time.time() - start:.1f} 秒")

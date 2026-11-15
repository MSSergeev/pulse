"""Токены сессии по её транскриптам: итог и вес каждого источника (основной диалог, типы субагентов).

Ответ модели пишется в транскрипт несколькими строками с одним message.id и одинаковым
usage, поэтому берём последнюю строку каждого id.

Допущение: расход лимита подписки пропорционален цене по API. Веса — соотношения цен
Anthropic для моделей Claude 4 (вывод ×5 к вводу, чтение кэша ×0.1, запись ×1.25);
цену самой модели не учитываем. Пересмотреть, если Anthropic опубликует, как считается лимит.
"""

import glob
import json
import os
import sys

KEYS = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
WEIGHTS = (1.0, 5.0, 0.1, 1.25)
MAIN = "@main"  # служебные имена: переводит мод (hooks/i18n.ts)
SUBAGENT = "@subagent"


def source(path: str) -> str:
    try:
        with open(path[: -len(".jsonl")] + ".meta.json", encoding="utf-8") as f:
            return json.load(f).get("agentType") or SUBAGENT
    except (OSError, ValueError):
        return SUBAGENT


config = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
main = glob.glob(os.path.join(config, "projects", "*", f"{sys.argv[1]}.jsonl"))
files = [(p, MAIN) for p in main]
for m in main:
    files += [(p, source(p)) for p in glob.glob(os.path.join(m[: -len(".jsonl")], "subagents", "*.jsonl"))]

last = {}
for path, name in files:
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"usage"' not in line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            message = row.get("message")
            if row.get("type") == "assistant" and isinstance(message, dict) and isinstance(message.get("usage"), dict):
                last[(path, message.get("id"))] = (name, [message["usage"].get(k) or 0 for k in KEYS])

total = [0] * len(KEYS)
by = {}
for name, counts in last.values():
    total = [a + b for a, b in zip(total, counts)]
    by[name] = by.get(name, 0) + sum(c * w for c, w in zip(counts, WEIGHTS))

print(json.dumps({"total": total, "by": sorted(by.items(), key=lambda item: -item[1])}, ensure_ascii=False))

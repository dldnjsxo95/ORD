# data/layout.json 의 괄호 요약(note)을 data/ord-<버전>.json 의 스킬 툴팁 수치와 대조한다.
# 사용: python -I tools/map-extract/verify-notes.py  → docs/03-research/ord-2.323-요약대조.md
import io
import json
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
db = json.load(io.open("data/ord-2.323.json", encoding="utf-8"))
lay = json.load(io.open("data/layout.json", encoding="utf-8"))
by = {u["id"]: u for u in db["units"]}
NUM = r"(\d+(?:\.\d+)?)"


def facts(text: str) -> dict[str, set[str]]:
    """툴팁에서 수치 사실을 뽑는다. 값은 문자열 집합."""
    f: dict[str, set[str]] = defaultdict(set)
    for m in re.finditer(r"방어력[^\n%]{0,10}?" + NUM + r"\s*(?:%)?\s*(?:감소|깎|낮)", text):
        f["격"].add(m.group(1))
    for m in re.finditer(r"이동\s*속도[^\n]{0,10}?" + NUM + r"\s*%?\s*(?:감소|느려)", text):
        f["이감"].add(m.group(1))
    for m in re.finditer(r"공격력[^\n]{0,10}?" + NUM + r"\s*%\s*증가", text):
        f["공증"].add(m.group(1))
    for m in re.finditer(r"공격\s*속도[^\n]{0,10}?" + NUM + r"\s*%?\s*증가", text):
        f["공속"].add(m.group(1))
    for m in re.finditer(NUM + r"\s*초\s*(?:동안\s*)?(?:기절|스턴)", text):
        f["스턴"].add(m.group(1))
    for m in re.finditer(r"(?:기절|스턴)[^\n]{0,8}?" + NUM + r"\s*초", text):
        f["스턴"].add(m.group(1))
    for m in re.finditer(r"마나\s*(?:회복|재생)[^\n]{0,6}?" + NUM, text):
        f["마젠"].add(m.group(1))
    for m in re.finditer(r"체력\s*(?:회복|재생)[^\n]{0,6}?" + NUM, text):
        f["체젠"].add(m.group(1))
    for m in re.finditer(r"마법\s*방어력[^\n]{0,10}?" + NUM + r"\s*%?\s*감소", text):
        f["마방격"].add(m.group(1))
    return f


def claims(note: str) -> list[tuple[str, str]]:
    """요약에서 (종류, 값) 주장을 뽑는다."""
    out = []
    for m in re.finditer(r"(발동|단일|마방)?(격|이감|공증|공속|마젠|체젠|제젠)\s*(-?\d+(?:\.\d+)?)", note):
        kind = m.group(2)
        if m.group(1) == "마방" and kind == "격":
            kind = "마방격"
        if kind == "제젠":
            kind = "체젠"
        out.append((kind, m.group(3).lstrip("-")))
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*스(?:턴)?(?![가-힣\d])", note):
        out.append(("스턴", m.group(1)))
    for m in re.finditer(r"스턴\s*(\d+(?:\.\d+)?)", note):
        out.append(("스턴", m.group(1)))
    return out


def num_eq(a: str, b: str) -> bool:
    try:
        return abs(float(a) - float(b)) < 1e-6
    except ValueError:
        return a == b


rows = []
stat = {"ok": 0, "mismatch": 0, "unverifiable": 0, "noclaim": 0}
for col in lay["columns"]:
    for pnl in col:
        for e in pnl.get("entries", []):
            uid = e.get("id")
            if not uid or uid not in by or pnl["kind"] != "units":
                continue
            u = by[uid]
            note = e.get("note", "")
            text = "\n".join(s["tip"] for s in u["skills"])
            fc = facts(text)
            cl = claims(note)
            if not cl:
                stat["noclaim"] += 1
                continue
            verdicts = []
            worst = "ok"
            for kind, val in cl:
                have = fc.get(kind, set())
                if not have:
                    verdicts.append(f"{kind}{val}: 툴팁에 수치 없음")
                    worst = "unverifiable" if worst == "ok" else worst
                elif any(num_eq(val, h) for h in have):
                    verdicts.append(f"{kind}{val}: 일치")
                else:
                    verdicts.append(f"{kind}{val}: 툴팁은 {', '.join(sorted(have, key=float))}")
                    worst = "mismatch"
            stat[worst] += 1
            rows.append((pnl["title"], e.get("label", u["name"]), uid, note, worst, verdicts))

md = [f"# 요약 대조 (ORDR_S2_2.323)\n", "괄호 요약의 수치를 맵 스킬 툴팁 수치와 자동 대조. 종류: 격(방어력 감소), 이감, 공증, 공속, 스턴(초), 마젠, 체젠, 마방격.\n",
      f"결과: 일치 {stat['ok']} / 불일치 {stat['mismatch']} / 확인불가 {stat['unverifiable']} / 수치 없는 요약 {stat['noclaim']}\n",
      "| 패널 | 유닛 | 요약 | 판정 | 세부 |", "|---|---|---|---|---|"]
for panel, label, uid, note, worst, verdicts in rows:
    if worst == "ok":
        continue
    md.append(f"| {panel} | {label} ({uid}) | {note} | {'불일치' if worst == 'mismatch' else '확인불가'} | {'; '.join(verdicts)} |")
md.append("\n## 일치한 항목\n")
md.append(", ".join(f"{label}" for _, label, _, _, worst, _ in rows if worst == "ok"))
io.open("docs/03-research/ord-2.323-요약대조.md", "w", encoding="utf-8").write("\n".join(md) + "\n")
print(stat)
for panel, label, uid, note, worst, verdicts in rows:
    if worst == "mismatch":
        print(f"[불일치] {panel} {label}: {note} → " + "; ".join(v for v in verdicts if "툴팁은" in v))

// 추천 조합: 지금 보유한 패로 만들 수 있는 후보들의 묶음을 전부 따져 보고, 남는 패가 가장 적은 묶음을 고른다.
// "패를 가장 많이 쓰는 것부터" 고르는 탐욕 방식은 특정 패를 한 조합에 몰아 써서 다른 조합을 막을 수 있으므로
// (사용자 지적 2026-10-24) 묶음 단위로 비교한다. 순수 함수 — 반응형 상태를 읽지 않는다.
//
// 남는 패의 무게 = 그 유닛의 최하위 재료 수(leafTotal). 전설 한 장이 흔함 여러 장보다 더 아깝게 센다.
// 같으면 남는 장수, 그다음 조합 수가 적은 쪽.
import type { Database } from '$lib/api';
import { allocate, craftRecipe, leafTotal, rankOf, shortage, baseOf, WISP_ID, type Need } from '$lib/combo-tree';

export interface RecommendOpts {
  /** 후보 유닛 id (모드·등급으로 걸러서 넘긴다) */
  candidates: readonly string[];
  /** 최상위 등급 이름들과 한도 (초월은 따로 1기) */
  topGrades?: readonly string[];
  topLimit?: number;
  transcendLimit?: number;
  /** 탐색 노드 상한. 넘으면 그때까지 찾은 최선을 돌려주고 complete=false */
  nodeBudget?: number;
}

export interface Pick {
  id: string;
  /** 같은 유닛을 몇 번 가는지 */
  times: number;
  /** 이 조합(들)이 쓰는 보유 패 수 */
  cards: number;
}

export interface Recommendation {
  picks: Pick[];
  /** 남는 패 (수량 > 0, 위습 제외), 높은 등급부터 */
  leftover: Need[];
  leftoverCount: number;
  leftoverWeight: number;
  /** 전부 탐색했는지 (false 면 노드 상한에 걸려 근사) */
  complete: boolean;
  nodes: number;
}

const DEFAULT_TOP = ['초월', '불멸', '영원', '제한', '신비'];

/** 패로 세지 않는 유닛: 위습, 오로성(맵에 있는 것을 보유로 읽을 뿐 재료가 아니다), 등급 없는 코드 */
function notCard(db: Database, id: string): boolean {
  if (id === WISP_ID || rankOf(db, id) < 0) return true;
  return db.units.find((u) => u.id === id)?.grade === '오로성';
}

function leftoverOf(db: Database, counts: ReadonlyMap<string, number>): { count: number; weight: number } {
  let count = 0;
  let weight = 0;
  for (const [id, n] of counts) {
    if (n <= 0 || notCard(db, id)) continue;
    count += n;
    weight += n * Math.max(1, leafTotal(db, id));
  }
  return { count, weight };
}

function keyOf(counts: ReadonlyMap<string, number>, evo: string | null, start: number): string {
  const parts: string[] = [];
  for (const [id, n] of counts) if (n > 0) parts.push(`${id}:${n}`);
  parts.sort();
  return `${start}|${evo ?? ''}|${parts.join(',')}`;
}

/**
 * counts 는 가정 배정 뒤 남은 패, evolution 은 남은 진화체. 위습은 쓰지 않는다 (실제로 있는 유닛이 아니므로).
 */
export function recommend(db: Database, counts: ReadonlyMap<string, number>, evolution: string | null, opts: RecommendOpts): Recommendation {
  const topGrades = opts.topGrades ?? DEFAULT_TOP;
  const topLimit = opts.topLimit ?? 3;
  const transcendLimit = opts.transcendLimit ?? 1;
  const budget = opts.nodeBudget ?? 40000;
  const gradeOf = (id: string) => db.units.find((u) => u.id === id)?.grade ?? null;

  // 지금 만들 수 있는 후보만. 패를 많이 쓰는 순으로 두면 좋은 답을 일찍 찾아 가지치기가 잘 된다.
  const evoBase = evolution ? baseOf(db, evolution) : null;
  const rootCands: { id: string; cards: number; grade: string | null }[] = [];
  for (const id of new Set(opts.candidates)) {
    if (!craftRecipe(db, id)) continue;
    const extra = evoBase && evoBase !== baseOf(db, id) ? new Map([[evoBase, 1]]) : undefined;
    const s = shortage(db, id, (u) => counts.get(u) ?? 0, { extra });
    if (s.missingTotal > 0) continue;
    let cards = 0;
    for (const n of s.used.values()) cards += n;
    rootCands.push({ id, cards, grade: gradeOf(id) });
  }
  rootCands.sort((a, b) => b.cards - a.cards || rankOf(db, b.id) - rankOf(db, a.id));
  const cands = rootCands.map((c) => c.id);
  // 가지치기용: i 번째 이후 후보들이 (처음 상태에서) 쓰는 패의 집합. 이 패 말고는 더 줄일 수 없다
  const suffixUsable: Set<string>[] = new Array(cands.length + 1);
  suffixUsable[cands.length] = new Set();
  for (let i = cands.length - 1; i >= 0; i--) {
    const s = new Set(suffixUsable[i + 1]);
    const ex = evoBase && evoBase !== baseOf(db, cands[i]) ? new Map([[evoBase, 1]]) : undefined;
    for (const u of shortage(db, cands[i], (u) => counts.get(u) ?? 0, { extra: ex }).used.keys()) s.add(u);
    suffixUsable[i] = s;
  }
  const weightOf = (id: string) => Math.max(1, leafTotal(db, id));
  const isTop = (id: string) => {
    const g = gradeOf(id);
    return !!g && topGrades.includes(g);
  };
  const isTranscend = (id: string) => gradeOf(id) === '초월';

  const base = leftoverOf(db, counts);
  let best: { picks: string[]; counts: Map<string, number>; count: number; weight: number } = { picks: [], counts: new Map(counts), ...base };
  let nodes = 0;
  let complete = true;
  const seen = new Set<string>();

  const better = (w: number, c: number, p: number) =>
    w < best.weight || (w === best.weight && (c < best.count || (c === best.count && p < best.picks.length)));

  const dfs = (cur: Map<string, number>, evo: string | null, start: number, picks: string[], top: number, tr: number) => {
    if (nodes++ > budget) { complete = false; return; }
    const lo = leftoverOf(db, cur);
    if (better(lo.weight, lo.count, picks.length)) best = { picks: [...picks], counts: cur, ...lo };
    if (lo.weight === 0) return;
    // 남은 후보들이 쓸 수 있는 패를 전부 써도 지금 최선보다 못하면 더 내려가지 않는다
    let gain = 0;
    for (const u of suffixUsable[start]) gain += (cur.get(u) ?? 0) * weightOf(u);
    if (lo.weight - gain > best.weight) return;
    for (let i = start; i < cands.length; i++) {
      const id = cands[i];
      if (isTranscend(id) && tr >= transcendLimit) continue;
      if (isTop(id) && top >= topLimit) continue;
      // 지금 패로 만들 수 없으면(부족) 건너뛴다. 위습은 쓰지 않는다
      const evoB = evo ? baseOf(db, evo) : null;
      const ex = evoB && evoB !== baseOf(db, id) ? new Map([[evoB, 1]]) : undefined;
      if (shortage(db, id, (u) => cur.get(u) ?? 0, { extra: ex }).missingTotal > 0) continue;
      const a = allocate(db, [id], cur, evo, 0); // 패·진화체 차감 (가정 배정과 같은 규칙)
      const key = keyOf(a.counts, a.evolution, i);
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push(id);
      dfs(a.counts, a.evolution, i, picks, top + (isTop(id) ? 1 : 0), tr + (isTranscend(id) ? 1 : 0));
      picks.pop();
      if (!complete) return;
    }
  };
  dfs(new Map(counts), evolution, 0, [], 0, 0);

  // 결과 정리: 같은 유닛은 묶고, 등급 높은 순
  const times = new Map<string, number>();
  for (const id of best.picks) times.set(id, (times.get(id) ?? 0) + 1);
  const picks: Pick[] = [...times.entries()]
    .map(([id, t]) => ({ id, times: t, cards: t * (rootCands.find((c) => c.id === id)?.cards ?? 0) }))
    .sort((a, b) => rankOf(db, b.id) - rankOf(db, a.id) || b.cards - a.cards);
  const leftover: Need[] = [...best.counts.entries()]
    .filter(([id, n]) => n > 0 && !notCard(db, id))
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => rankOf(db, b.id) - rankOf(db, a.id) || a.id.localeCompare(b.id));
  return { picks, leftover, leftoverCount: best.count, leftoverWeight: best.weight, complete, nodes };
}

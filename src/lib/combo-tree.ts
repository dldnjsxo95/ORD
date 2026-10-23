// 조합 트리 계산 (순수 함수). DB 의 craft 조합식만 트리로 본다 (random_only/special 은 재료가 없는 최하위로 취급).
// 수량은 호출자가 넘기는 count(id) 로 읽어 메인 화면의 보유 수량(실시간 + 수동 조정)과 같은 값을 쓴다.
import type { Database, Recipe } from '$lib/api';

export interface Need {
  id: string;
  count: number;
}
/** 직속 재료 중 부족한 것: 필요 수량과, 그 재료를 만들기 위한 최하위 재료 중 보유한 비율(%) */
export interface MissingDirect extends Need {
  pct: number;
}
export interface Shortage {
  /** 부족한 직속 재료 */
  direct: MissingDirect[];
  /** 보유량을 반영하고도 모자라는 최하위 재료 */
  missingBase: Need[];
  /** 아직 만들어야 하는 중간 유닛 (최하위·최종 유닛 제외), 낮은 등급부터 */
  toCraft: Need[];
  /** 이 조합에 쓰이는 보유 패 (유닛 id → 소모 수). 진화체(extra)로 대신한 몫도 포함 */
  used: Map<string, number>;
  /** 부족한 흔함 재료를 대신하는 데 쓴 흔함선택위습 수 */
  wispsUsed: number;
}

interface Index {
  recipe: Map<string, Recipe>;
  parents: Map<string, string[]>;
  /** 유닛 id → 등급 순위 (db.grades 순서, 모르면 -1) */
  rank: Map<string, number>;
  /** 유닛 id → 기본형 id (스킨·변형 체인 해소) */
  base: Map<string, string>;
  common: Set<string>;
  /** 유닛 id → 최하위 재료 총수 (지연 계산 캐시) */
  leafTotal: Map<string, number>;
}
let cached: { db: Database; idx: Index } | null = null;

// 이 색인은 DB 가 바뀔 때만 다시 만든다. 게이지 계산은 매 상태 갱신마다 수천 번 조회하므로
// 반응형 스토어(Svelte 신호)를 거치지 않는 순수 Map 조회여야 한다.
function index(db: Database): Index {
  if (cached?.db === db) return cached.idx;
  const recipe = new Map<string, Recipe>();
  const parents = new Map<string, string[]>();
  for (const r of db.recipes) {
    if (r.kind !== 'craft' || r.materials.length === 0) continue;
    if (!recipe.has(r.result)) recipe.set(r.result, r); // 결과가 같은 조합식이 둘이면 먼저 나온 것
    for (const m of r.materials) {
      const list = parents.get(m.unit) ?? [];
      if (!list.includes(r.result)) list.push(r.result);
      parents.set(m.unit, list);
    }
  }
  const byId = new Map(db.units.map((u) => [u.id, u]));
  const rank = new Map<string, number>();
  const base = new Map<string, string>();
  const common = new Set<string>();
  for (const u of db.units) {
    rank.set(u.id, u.grade ? db.grades.indexOf(u.grade) : -1);
    if (u.grade === '흔함') common.add(u.id);
    let cur = u.id;
    for (let i = 0; i < 8; i++) {
      const b = byId.get(cur)?.baseForm;
      if (!b || b === cur) break;
      cur = b;
    }
    base.set(u.id, cur);
  }
  cached = { db, idx: { recipe, parents, rank, base, common, leafTotal: new Map() } };
  return cached.idx;
}

/** 최하위 재료 총수 (캐시) */
export function leafTotal(db: Database, id: string): number {
  const idx = index(db);
  let t = idx.leafTotal.get(id);
  if (t === undefined) {
    t = sum(baseMaterials(db, id));
    idx.leafTotal.set(id, t);
  }
  return t;
}

export const rankOf = (db: Database, id: string): number => index(db).rank.get(id) ?? -1;
export const baseOf = (db: Database, id: string): string => index(db).base.get(id) ?? id;
export const isCommon = (db: Database, id: string): boolean => index(db).common.has(id);

/** 이 유닛을 만드는 craft 조합식 (없으면 최하위 재료) */
export function craftRecipe(db: Database, id: string): Recipe | undefined {
  return index(db).recipe.get(id);
}

/** 직속 재료 */
export function directMaterials(db: Database, id: string): Need[] {
  return (craftRecipe(db, id)?.materials ?? []).map((m) => ({ id: m.unit, count: m.count }));
}

/** 재료 트리를 끝까지 펼쳤을 때의 최하위 재료 총개수 (보유 여부 무관) */
export function baseMaterials(db: Database, id: string, n = 1, acc = new Map<string, number>(), depth = 0): Map<string, number> {
  const r = craftRecipe(db, id);
  if (!r || depth > 32) {
    acc.set(id, (acc.get(id) ?? 0) + n);
    return acc;
  }
  for (const m of r.materials) baseMaterials(db, m.unit, m.count * n, acc, depth + 1);
  return acc;
}

/** 이 유닛을 재료로 쓰는 한 단계 위 유닛들 */
export function parents(db: Database, id: string): string[] {
  return index(db).parents.get(id) ?? [];
}

/** 부모를 끝까지 올라갔을 때 더 이상 부모가 없는 유닛들 */
export function topParents(db: Database, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (cur: string) => {
    if (seen.has(cur)) return;
    seen.add(cur);
    const ps = parents(db, cur);
    if (ps.length === 0) {
      if (cur !== id) out.push(cur);
      return;
    }
    for (const p of ps) walk(p);
  };
  walk(id);
  return out;
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

export interface ShortageOpts {
  /** 보유량에 더해 쓸 수 있는 유닛 (예: 진화체 → 그 유닛 1기). 키는 유닛 id 또는 기본형 id */
  extra?: ReadonlyMap<string, number>;
  /** 흔함선택위습 수. 부족한 흔함 최하위 재료를 하나씩 대신한다 */
  wisps?: number;
  /** 흔함 유닛 판정 (위습 대체 대상) */
  isCommon?: (id: string) => boolean;
  /** 기본형 id (스킨·변형 → 기본). extra 조회에 쓴다 */
  baseOf?: (id: string) => string;
}

/**
 * 보유 수량을 반영한 부족분. 보유한 중간 재료는 그만큼 하위로 펼치지 않고 차감한다.
 * 재료 사이에 공유되는 하위 재료가 이중으로 계산되지 않도록 보유량 차감은 재료 순서대로 누적한다.
 * opts.extra(진화체)는 보유량처럼 차감되고, opts.wisps 는 마지막에 부족한 흔함 재료를 대신한다.
 */
export function shortage(
  db: Database,
  id: string,
  count: (id: string) => number,
  opts: ShortageOpts = {},
): Shortage & { total: number; missingTotal: number } {
  const idx = index(db);
  const gradeRank = (u: string) => idx.rank.get(u) ?? -1;
  const common = opts.isCommon ?? ((u: string) => idx.common.has(u));
  const toBase = opts.baseOf ?? ((u: string) => idx.base.get(u) ?? u);
  const avail = new Map<string, number>();
  const extraOf = (u: string) => opts.extra?.get(u) ?? opts.extra?.get(toBase(u)) ?? 0;
  const left = (u: string) => avail.get(u) ?? Math.max(0, count(u)) + extraOf(u);
  const missing = new Map<string, number>();
  const toCraft = new Map<string, number>();
  const used = new Map<string, number>();

  const need = (u: string, n: number, depth: number) => {
    const take = Math.min(left(u), n);
    avail.set(u, left(u) - take);
    if (take > 0) used.set(u, (used.get(u) ?? 0) + take);
    n -= take;
    if (n <= 0) return;
    const r = craftRecipe(db, u);
    if (!r || depth > 32) {
      missing.set(u, (missing.get(u) ?? 0) + n);
      return;
    }
    toCraft.set(u, (toCraft.get(u) ?? 0) + n);
    for (const m of r.materials) need(m.unit, m.count * n, depth + 1);
  };

  const direct: MissingDirect[] = [];
  for (const m of directMaterials(db, id)) {
    const owned = count(m.id);
    const before = sum(missing);
    need(m.id, m.count, 1);
    if (owned >= m.count) continue;
    const total = sum(baseMaterials(db, m.id, m.count));
    const lacking = sum(missing) - before;
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((1 - lacking / total) * 100))) : 100;
    direct.push({ id: m.id, count: m.count, pct });
  }

  const byGrade = (a: Need, b: Need) => gradeRank(a.id) - gradeRank(b.id) || a.id.localeCompare(b.id);
  const missingBase = [...missing.entries()].map(([id, count]) => ({ id, count })).sort(byGrade);

  // 흔함선택위습: 부족한 흔함 최하위 재료를 낮은 등급·id 순으로 하나씩 대신한다
  const pool0 = Math.max(0, opts.wisps ?? 0);
  let pool = pool0;
  if (pool > 0) {
    for (const m of missingBase) {
      if (pool <= 0) break;
      if (!common(m.id)) continue;
      const take = Math.min(pool, m.count);
      m.count -= take;
      pool -= take;
    }
  }

  return {
    direct,
    missingBase: missingBase.filter((m) => m.count > 0),
    toCraft: [...toCraft.entries()].map(([id, count]) => ({ id, count })).sort(byGrade),
    used,
    wispsUsed: pool0 - pool,
    total: leafTotal(db, id),
    missingTotal: missingBase.reduce((a, m) => a + m.count, 0),
  };
}

/** 흔함선택위습 유닛 id */
export const WISP_ID = 'e018';

/** 어느 시점의 보유 상태: 수량 표 + 남은 위습 + 남은 진화체 */
export interface Holdings {
  counts: Map<string, number>;
  wisps: number;
  evolution: string | null;
}

/** 보유 패를 가정 목표에 순서대로 배정하고 남은 상태 */
export interface Allocation extends Holdings {
  /** 가정 목표별로, 그 목표를 배정하기 직전의 상태 (그 행의 게이지는 이 상태로 그린다) */
  before: Map<string, Holdings>;
}

/**
 * 가정 목표들을 순서대로 "간다"고 보고 보유 패·위습·진화체를 차감한다.
 * 나머지 유닛의 게이지와 정렬은 여기서 돌려준 남은 상태로 계산하면 된다.
 */
export function allocate(db: Database, targets: readonly string[], counts: ReadonlyMap<string, number>, evolution: string | null, wisps: number): Allocation {
  let cur = new Map(counts);
  let curWisps = Math.max(0, wisps);
  let curEvo = evolution;
  const before = new Map<string, Holdings>();
  for (const t of targets) {
    before.set(t, { counts: cur, wisps: curWisps, evolution: curEvo });
    const evoBase = curEvo ? baseOf(db, curEvo) : null;
    const extra = evoBase && evoBase !== baseOf(db, t) ? new Map([[evoBase, 1]]) : undefined;
    const s = shortage(db, t, (u) => cur.get(u) ?? 0, { extra, wisps: curWisps });
    const next = new Map(cur);
    let evoConsumed = evoBase === baseOf(db, t); // 진화체가 목표 자신이면 그걸로 만든다
    for (const [u, n] of s.used) {
      const owned = cur.get(u) ?? 0;
      if (evoBase && baseOf(db, u) === evoBase && n > owned) evoConsumed = true; // 보유량을 넘겨 쓴 1기가 진화체
      next.set(u, Math.max(0, owned - n));
    }
    if (s.wispsUsed > 0) next.set(WISP_ID, Math.max(0, (next.get(WISP_ID) ?? 0) - s.wispsUsed)); // 위습 행의 수량 표시도 맞춘다
    cur = next;
    curWisps -= s.wispsUsed;
    if (evoConsumed) curEvo = null;
  }
  return { counts: cur, wisps: curWisps, evolution: curEvo, before };
}

/** 정렬 키: 이 조합이 보유 패를 등급별로 몇 기 쓰는지 (높은 등급 → 낮은 등급 순 배열) */
export function usedByGrade(db: Database, id: string, count: (id: string) => number, evolution: string | null, wisps: number): number[] {
  const idx = index(db);
  const out = new Array<number>(db.grades.length).fill(0);
  if (!craftRecipe(db, id)) return out;
  const evoBase = evolution ? baseOf(db, evolution) : null;
  const extra = evoBase && evoBase !== baseOf(db, id) ? new Map([[evoBase, 1]]) : undefined;
  const s = shortage(db, id, count, { extra, wisps });
  for (const [u, n] of s.used) {
    const r = idx.rank.get(u) ?? -1;
    if (r >= 0) out[db.grades.length - 1 - r] += n; // 높은 등급이 앞에 오도록 뒤집는다
  }
  return out;
}

/** usedByGrade 배열 비교 (내림차순 정렬용): 앞(높은 등급)부터 큰 쪽이 먼저 */
export function compareUsage(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}

/** 조합 게이지 구간 (전체 최하위 재료 대비 비율): 보유 → 진화체가 덮는 몫 → 위습이 대신하는 몫 */
export interface Gauge {
  own: number;
  evo: number;
  wisp: number;
  /** 보유 + 진화체만으로 재료가 모두 갖춰진다 (초록) */
  ready: boolean;
  /** 흔함선택위습까지 써야 갖춰진다 (위습 구간 빨강) */
  complete: boolean;
}

/**
 * 유닛 하나의 게이지. 진화체(evolution)는 그 유닛 1기를 더 가진 것으로, 위습은 흔함 재료 대체로 계산해
 * "보유만 / 보유+진화체 / 보유+진화체+위습" 세 번의 부족분 차이로 구간 크기를 낸다.
 * 진화체가 이 유닛 자체면 부족분 전체를 진화체 구간으로 본다.
 */
export function gauge(db: Database, id: string, count: (id: string) => number, evolution: string | null | undefined, wisps: number): Gauge | null {
  if (!craftRecipe(db, id)) return null;
  const base = shortage(db, id, count);
  const total = base.total;
  if (!total) return null;
  const m0 = base.missingTotal;
  const evoSelf = !!evolution && baseOf(db, evolution) === baseOf(db, id);
  const extra = evolution && !evoSelf ? new Map([[baseOf(db, evolution), 1]]) : undefined;
  const m1 = evoSelf ? 0 : extra ? shortage(db, id, count, { extra }).missingTotal : m0;
  const m2 = wisps > 0 && m1 > 0 ? shortage(db, id, count, { extra, wisps }).missingTotal : m1;
  return { own: (total - m0) / total, evo: (m0 - m1) / total, wisp: (m1 - m2) / total, ready: m1 === 0, complete: m1 > 0 && m2 === 0 };
}

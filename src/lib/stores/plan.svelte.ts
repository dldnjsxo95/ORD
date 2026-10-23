// 계획 상태: 수동 수량 조정(+/−), 정렬, 능력치 필터, 패널 접기. 실시간 보유량 위에 얹는 what-if 계층.
// 수동 조정이 하나라도 있으면 백엔드 simulate 로 조합을 다시 계산한다.

// 개발 모드: 이 모듈이 바뀌면 페이지 전체를 다시 불러온다
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

import { api, type ComboStatus } from '$lib/api';
import { game, base, pushLog, unitName } from './game.svelte';

/** 정렬: 기본(사양서 순) / 이름 / 수량 / 패 활용 (보유 패를 높은 등급부터 많이 쓰는 조합이 위) */
export type SortMode = 'default' | 'name' | 'count' | 'usage';

interface PlanState {
  /** 유닛 id -> 수동 증감 (음수 가능, 유효 수량은 0 이상으로 보정) */
  manual: Record<string, number>;
  skillPoints: number;
  /** 추천 조합 모드 (물딜/마딜) */
  mode: string;
  sort: SortMode;
  filters: string[];
  filterOpen: boolean;
  collapsed: Record<string, boolean>;
  /** 수동 조정이 있을 때의 조합 평가 결과 (없으면 null → 실시간 결과 사용) */
  simulated: ComboStatus[] | null;
  /** 우클릭으로 "간다"고 가정한 유닛들 (순서대로 패를 배정). 세션 한정, 저장하지 않음 */
  assumed: string[];
  /** 가정한 시점의 실시간 보유 수 (유닛 id → 수). 보유가 이보다 늘면 = 실제로 만들어졌으므로 가정을 자동 해제한다 */
  assumedBase: Record<string, number>;
}

const KEY = 'ord-helper.plan';

function load(): PlanState {
  const base: PlanState = { manual: {}, skillPoints: 0, mode: '물딜', sort: 'default', filters: [], filterOpen: true, collapsed: {}, simulated: null, assumed: [], assumedBase: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return { ...base, mode: saved.mode === '마딜' ? '마딜' : '물딜', sort: saved.sort ?? 'default', filters: saved.filters ?? [], filterOpen: saved.filterOpen ?? true, collapsed: saved.collapsed ?? {} };
  } catch {
    return base;
  }
}

export const plan = $state<PlanState>(load());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode: plan.mode, sort: plan.sort, filters: plan.filters, filterOpen: plan.filterOpen, collapsed: plan.collapsed }));
  } catch {
    /* 무시 */
  }
}

/** 실시간 보유량 (정리된 목록 기준) */
export function liveCount(id: string): number {
  return game.payload?.owned.find((o) => o.id === id)?.count ?? 0;
}

/** 화면에 보이는 유효 수량 = 실시간 + 수동 조정, 0 이상 */
export function effectiveCount(id: string): number {
  return Math.max(0, liveCount(id) + (plan.manual[id] ?? 0));
}

/**
 * 모든 유닛의 유효 수량을 한 번에 담은 순수 Map. 게이지·트리 계산처럼 수량을 수천 번 조회하는 곳에서
 * effectiveCount 대신 쓴다 (반응형 상태를 매번 읽지 않도록). $derived 안에서 호출하면 수량 변화에 따라간다.
 */
export function effectiveCounts(): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of game.payload?.owned ?? []) m.set(o.id, o.count);
  for (const [id, d] of Object.entries(plan.manual)) m.set(id, Math.max(0, (m.get(id) ?? 0) + d));
  return m;
}

/** 변형 유닛용: 정리 전 원본 수량 + 수동 조정 (그 코드만) */
export function rawCount(id: string): number {
  return Math.max(0, (game.payload?.state.units[id] ?? 0) + (plan.manual[id] ?? 0));
}

export function hasManual(): boolean {
  return Object.keys(plan.manual).length > 0;
}

export function adjust(id: string, delta: number) {
  const next = Math.max(0, effectiveCount(id) + delta);
  const manual = next - liveCount(id);
  if (manual === 0) delete plan.manual[id];
  else plan.manual[id] = manual;
  scheduleSimulate();
}

export function resetAll() {
  // 실시간 보유량까지 0 으로 보이게: 음수 보정
  const next: Record<string, number> = {};
  for (const o of game.payload?.owned ?? []) next[o.id] = -o.count;
  plan.manual = next;
  plan.skillPoints = 0;
  scheduleSimulate();
}

/** 수동 조정만 지우고 실시간 값으로 복귀 */
export function clearManual() {
  plan.manual = {};
  plan.simulated = null;
}

/** 유닛(스킨·변형 포함)의 실시간 보유 수. 가정 해제 판정용 */
function liveCountWithBase(id: string): number {
  const b = base(id);
  let n = 0;
  for (const o of game.payload?.owned ?? []) if (o.id === id || o.id === b || base(o.id) === b) n += o.count;
  return n;
}

/** 우클릭: 이 유닛을 간다고 가정 (이미 가정했으면 해제) */
export function toggleAssumed(id: string) {
  if (plan.assumed.includes(id)) {
    plan.assumed = plan.assumed.filter((x) => x !== id);
    delete plan.assumedBase[id];
  } else {
    plan.assumed = [...plan.assumed, id];
    plan.assumedBase[id] = liveCountWithBase(id);
  }
}

export function clearAssumed() {
  plan.assumed = [];
  plan.assumedBase = {};
}

/** 실시간 갱신 시: 가정한 유닛이 실제로 생성됐으면(보유가 가정 시점보다 늘면) 가정을 자동으로 푼다 */
function releaseCraftedAssumed() {
  if (!game.payload || plan.assumed.length === 0) return;
  const done = plan.assumed.filter((id) => liveCountWithBase(id) > (plan.assumedBase[id] ?? 0));
  if (done.length === 0) return;
  plan.assumed = plan.assumed.filter((id) => !done.includes(id));
  for (const id of done) {
    delete plan.assumedBase[id];
    pushLog(`가정 해제: ${unitName(id)} 생성됨`);
  }
}

export function setMode(mode: string) {
  plan.mode = mode;
  save();
}

export function setSort(sort: SortMode) {
  plan.sort = sort;
  save();
}

export function toggleFilter(label: string) {
  plan.filters = plan.filters.includes(label) ? plan.filters.filter((f) => f !== label) : [...plan.filters, label];
  save();
}

export function clearFilters() {
  plan.filters = [];
  save();
}

export function setFilterOpen(open: boolean) {
  plan.filterOpen = open;
  save();
}

export function toggleCollapsed(id: string) {
  plan.collapsed[id] = !plan.collapsed[id];
  save();
}

/** 현재 조합 평가: 수동 조정이 있으면 simulate 결과, 없으면 실시간 결과 */
export function combos(): ComboStatus[] {
  return plan.simulated ?? game.payload?.combos ?? [];
}

let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleSimulate() {
  if (timer) clearTimeout(timer);
  if (!hasManual()) { plan.simulated = null; return; }
  timer = setTimeout(async () => {
    // 유효 수량 = 실시간 원본(변형 포함) + 수동. 백엔드가 변형·분신을 다시 정리한다.
    const units: Record<string, number> = { ...(game.payload?.state.units ?? {}) };
    for (const [id, d] of Object.entries(plan.manual)) units[id] = Math.max(0, (units[id] ?? 0) + d);
    try {
      plan.simulated = await api.simulate(units, game.payload?.state.gold, game.payload?.state.wood ?? undefined);
    } catch (e) {
      game.error = `시뮬레이션 실패: ${e}`;
    }
  }, 120);
}

/** 실시간 데이터가 갱신되면: 생성된 가정 유닛을 풀고, 수동 조정이 있을 때 다시 계산한다 (MainPanel 의 effect 에서 호출) */
export function onLiveUpdate() {
  releaseCraftedAssumed();
  if (hasManual()) scheduleSimulate();
}

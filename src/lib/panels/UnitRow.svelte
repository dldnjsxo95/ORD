<!-- 유닛 한 행(20px, 항상 한 줄): 초상(16px) · 등급표기 · [게이지 영역: 진행도%(있을 때만) · (티어)이름 · 배지들 · (요약)] · [+] [−](수동 모드만) · 수량.
     게이지는 퍼센트 글자부터 요약까지 영역을 위아래 꽉 채우며 왼쪽부터 찬다. 구간은 세 가지:
       보유 재료(초록) → 진화체로 대신할 수 있는 재료(보라) → 흔함선택위습으로 대신할 수 있는 흔함 재료(노랑).
     100% 라고 색을 따로 바꾸지 않는다. 위습까지 써야 100% 면 위습 구간만 빨강. 진행도 숫자에는 위습 구간을 넣지 않는다.
     우클릭 = 이 유닛을 간다고 가정 (MainPanel 이 나머지 행의 수량·게이지를 남은 패로 다시 계산).
     필터가 켜져 있고 안 맞으면 흐리게. -->
<script lang="ts">
  import type { Unit, ComboStatus } from '$lib/api';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import { BADGE_ICON as BADGE } from '$lib/badges';
  import { buildHover } from '$lib/tooltip';
  import { showHover, moveHover, hideHover } from '$lib/stores/hover.svelte';
  import { game, recipeOf, unitName, unitGrade, gradeRank, base } from '$lib/stores/game.svelte';
  import { plan } from '$lib/stores/plan.svelte';
  import { gauge, shortage, craftRecipe, baseOf } from '$lib/combo-tree';

  interface Props {
    unit: Unit;
    /** 표시 이름 (없으면 유닛 이름) */
    label?: string;
    /** 괄호 요약 (사양서 표기) */
    note?: string;
    /** 역할 배지 (사양서 표기) */
    badges?: string[];
    /** 티어 표기 (F~S) */
    tier?: string;
    count: number;
    combo?: ComboStatus;
    dimmed?: boolean;
    /** +/− 버튼 표시. 게임과 연동 중(실시간 수량)이면 숨긴다 */
    adjustable?: boolean;
    /** 모든 유닛의 유효 수량 (plan.effectiveCounts). 갱신당 한 번 만들어 모든 행이 공유한다 */
    counts: ReadonlyMap<string, number>;
    /** 보유한 흔함선택위습 수 (흔함 재료 하나를 대신한다) */
    wisps?: number;
    /** 진화체 유닛 typeId (시작 위치에 있는 진화 대상). 그 유닛이 재료면 하나를 대신한다 */
    evolution?: string | null;
    onadjust: (delta: number) => void;
    /** 이름·아이콘 영역 클릭 (조합 상세 열기). +/− 버튼은 해당 없음 */
    onopen?: () => void;
    /** 우클릭으로 "간다"고 가정한 유닛 */
    assumed?: boolean;
    /** 우클릭 (가정 토글) */
    onassume?: () => void;
  }
  let { unit, label, note, badges = [], tier, count, counts, combo, dimmed = false, adjustable = true, wisps = 0, evolution = null, onadjust, onopen, assumed = false, onassume }: Props = $props();

  const GRADE_SHORT: Record<string, string> = {
    흔함: '흔', 안흔함: '안', 특별: '특', 희귀: '희', 전설: '전', 히든: '히', 변화: '변', 제한: '제', 랜덤전용: '랜', 신비: '신',
    초월: '초', 불멸: '불', 영원: '영', 왜곡: '왜', 특수: '특수', 세라핌: '세', 오로성: '오',
  };

  /**
   * 게이지 구간: 재료 트리를 최하위까지 펼친 전체 재료 대비 비율 (combo-tree.gauge).
   * 보유 재료가 덮는 몫 → 진화체가 덮는 몫(그 유닛의 하위 재료까지) → 흔함선택위습이 대신할 수 있는 흔함 재료 몫.
   * 진행도 숫자(pct)는 보유 + 진화체만. 위습 구간은 색으로만 보여 주고 숫자에 넣지 않는다 (실제로 있는 유닛이 아니므로).
   * counts(수량 표)가 바뀌면 다시 계산된다. 계산 안에서는 반응형 상태를 읽지 않는다 (성능).
   */
  const seg = $derived.by(() => {
    if (!game.db) return null;
    const g = gauge(game.db, unit.id, (u) => counts.get(u) ?? 0, evolution, wisps);
    if (!g) return null;
    const w = (f: number) => `${f * 100}%`;
    return { ...g, pct: Math.round((g.own + g.evo) * 100), ownW: w(g.own), evoW: w(g.evo), wispW: w(g.wisp), evoL: w(g.own), wispL: w(g.own + g.evo) };
  });
  const pct = $derived(seg?.pct ?? 0);
  /** 진화체가 바로 이 유닛이면 수량에 +1 을 보라색으로 보여 준다 */
  const evoHere = $derived(!!evolution && base(evolution) === base(unit.id));

  /** 패 활용순일 때 호버 오른쪽에 보여 줄 "사용 패": 이 조합이 소모하는 내 보유 유닛 (흔함 제외, 높은 등급부터) */
  function usedCards(): string[] | undefined {
    if (plan.sort !== 'usage' || !game.db || !craftRecipe(game.db, unit.id)) return undefined;
    const db = game.db;
    const evoBase = evolution ? baseOf(db, evolution) : null;
    const extra = evoBase && evoBase !== baseOf(db, unit.id) ? new Map([[evoBase, 1]]) : undefined;
    const s = shortage(db, unit.id, (u) => counts.get(u) ?? 0, { extra, wisps });
    return [...s.used.entries()]
      .filter(([u]) => unitGrade(u) !== '흔함')
      .sort((a, b) => gradeRank(unitGrade(b[0])) - gradeRank(unitGrade(a[0])) || a[0].localeCompare(b[0]))
      .map(([u, n]) => `${unitName(u)}${unitGrade(u) ? ` (${unitGrade(u)})` : ''}${n > 1 ? ` ×${n}` : ''}`);
  }

  function enter(e: MouseEvent) {
    // 스킨·변형 유닛은 기본 유닛의 조합식을 보여 준다
    const recipe = recipeOf(unit.id) ?? recipeOf(base(unit.id));
    const content = buildHover(unit, { label, note, tier }, recipe, unitName, combo);
    content.used = usedCards();
    showHover(content, e.clientX, e.clientY);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="row" class:owned={count > 0} class:dimmed class:assumed onmouseenter={enter} onmousemove={(e) => moveHover(e.clientX, e.clientY)} onmouseleave={hideHover} oncontextmenu={(e) => { e.preventDefault(); onassume?.(); }}>
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <span class="open" onclick={onopen}><UnitIcon id={unit.id} name={unit.name} size={16} /></span>
  {#if unit.grade}<span class="grade g-{unit.grade}">{GRADE_SHORT[unit.grade] ?? unit.grade}</span>{/if}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <span class="main" onclick={onopen}>
    {#if seg}
      {#if seg.own > 0}<span class="fill own" style:width={seg.ownW}></span>{/if}
      {#if seg.evo > 0}<span class="fill evo" style:left={seg.evoL} style:width={seg.evoW}></span>{/if}
      {#if seg.wisp > 0}<span class="fill wisp" class:complete={seg.complete} style:left={seg.wispL} style:width={seg.wispW}></span>{/if}
    {/if}
    {#if pct > 0}<span class="pct">{pct}%</span>{/if}
    <span class="cell">
      {#if assumed}<span class="asm" title="간다고 가정한 유닛 (우클릭으로 해제)">가정</span>{/if}
      {#if tier}<span class="tier t-{tier.replace('+', 'p')}">({tier})</span>{/if}
      <span class="nm">{label ?? unit.name}</span>
      {#each badges as b, i (i)}{#if BADGE[b]}<span class="badge {b}"><Icon name={BADGE[b]} size={9} /></span>{/if}{/each}
      {#if note}<span class="stat">({note})</span>{/if}
    </span>
  </span>
  <span class="ctl">
    {#if adjustable}
      <button type="button" aria-label="추가" onclick={() => onadjust(1)}>+</button>
      <button type="button" aria-label="제거" onclick={() => onadjust(-1)} disabled={count === 0}>−</button>
    {/if}
    <span class="cnt" class:zero={count === 0 && !evoHere} class:evo={evoHere} title={evoHere ? '진화체 포함 (+1)' : undefined}>{count + (evoHere ? 1 : 0)}</span>
  </span>
</div>

<style>
  .row { display: flex; align-items: center; gap: 2px; height: 20px; padding: 0 2px 0 3px; font-size: 9px; color: var(--c-row-text); border-bottom: 1px solid var(--c-border-row); }
  .row:hover { background: var(--c-bg-hover); }
  .open { display: inline-flex; flex: none; cursor: pointer; }
  .row.dimmed { opacity: 0.28; }
  .row.assumed { outline: 1px solid var(--c-accent); outline-offset: -1px; }
  .asm { flex: none; font-size: 7px; line-height: 11px; padding: 0 3px; border-radius: 2px; background: var(--c-accent); color: var(--c-on-accent); font-weight: 700; }
  .grade { flex: none; min-width: 11px; padding: 0 2px; border-radius: 2px; font-size: 8px; line-height: 12px; text-align: center; color: var(--c-bg-app); background: var(--c-text-3); }
  .g-흔함, .g-안흔함 { background: var(--c-tier-1); } .g-특별, .g-희귀 { background: var(--c-tier-2); } .g-전설, .g-히든, .g-변화, .g-해적선 { background: var(--c-tier-3); }
  .g-제한, .g-랜덤전용, .g-신비, .g-왜곡, .g-특수 { background: var(--c-tier-4); } .g-초월, .g-불멸, .g-영원, .g-세라핌, .g-오로성 { background: var(--c-tier-5); }
  /* 게이지 영역: 퍼센트 글자 + 이름 칸. 채움은 위아래 꽉 차게 */
  .main { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; height: 100%; overflow: hidden; cursor: pointer; }
  .fill { position: absolute; top: 0; bottom: 0; left: 0; }
  .fill.own { background: color-mix(in srgb, var(--c-gauge-own) 62%, transparent); }
  .fill.evo { background: color-mix(in srgb, var(--c-gauge-evo) 62%, transparent); }
  .fill.wisp { background: color-mix(in srgb, var(--c-gauge-wisp) 62%, transparent); }
  .fill.wisp.complete { background: color-mix(in srgb, var(--c-danger) 62%, transparent); }
  /* 조합 진행도: 등급과 이름 사이, 숫자가 있을 때만 자리를 차지한다 */
  .pct { position: relative; flex: none; padding-left: 1px; font-size: 8px; color: var(--c-row-text); font-variant-numeric: tabular-nums; }
  .cell { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; height: 100%; overflow: hidden; }
  .tier { flex: none; font-size: 8px; font-weight: 700; color: var(--c-text-3); }
  .t-S { color: var(--c-danger-text); } .t-Ap, .t-A { color: var(--c-warn-text); } .t-B { color: var(--c-accent-text); } .t-C { color: var(--c-ok-text); }
  .nm { white-space: nowrap; flex: none; }
  .badge { display: inline-flex; flex: none; }
  .badge.flag { color: var(--c-danger); } .badge.sword { color: var(--c-text-2); }
  .badge.heart-blue { color: var(--c-accent-text); } .badge.heart-red { color: var(--c-danger-text); } .badge.heart-white { color: var(--c-text); } .badge.plus { color: var(--c-text); }
  /* 요약만 줄어든다 (이름·배지는 항상 보임) */
  .stat { flex: 1 1 0; min-width: 0; color: var(--c-row-text-2); font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ctl { display: inline-flex; align-items: center; gap: 1px; flex: none; }
  .ctl button { width: 14px; height: 14px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 10px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .cnt { min-width: 16px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--c-accent-text); }
  .cnt.zero { color: var(--c-text-3); font-weight: 400; }
  .cnt.evo { color: var(--c-gauge-evo); }
</style>

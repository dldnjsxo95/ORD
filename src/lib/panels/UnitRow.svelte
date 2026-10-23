<!-- 유닛 한 행(20px, 항상 한 줄): 초상(16px) · 등급표기 · 진행도%(있을 때만) · (티어)이름 · 배지들 · (요약) · [+] [−](수동 모드만) · 수량.
     이름 칸은 조합 진행도만큼 채워지는 게이지, 조합 가능하면 초록. 필터가 켜져 있고 안 맞으면 흐리게. -->
<script lang="ts">
  import type { Unit, ComboStatus } from '$lib/api';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import type { IconName } from '$lib/ui/icons';
  import { buildHover } from '$lib/tooltip';
  import { showHover, moveHover, hideHover } from '$lib/stores/hover.svelte';
  import { recipeOf, unitName, base } from '$lib/stores/game.svelte';

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
    onadjust: (delta: number) => void;
  }
  let { unit, label, note, badges = [], tier, count, combo, dimmed = false, adjustable = true, onadjust }: Props = $props();

  const BADGE: Record<string, IconName> = { flag: 'flag', sword: 'sword', 'heart-blue': 'heart', 'heart-red': 'heart', 'heart-white': 'heart', plus: 'plusCircle' };
  const GRADE_SHORT: Record<string, string> = {
    흔함: '흔', 안흔함: '안', 특별: '특', 희귀: '희', 전설: '전', 히든: '히', 변화: '변', 제한: '제', 랜덤전용: '랜', 신비: '신',
    초월: '초', 불멸: '불', 영원: '영', 왜곡: '왜', 특수: '특수', 세라핌: '세', 오로성: '오',
  };
  const pct = $derived(combo && combo.need ? Math.round((combo.have / combo.need) * 100) : 0);

  function enter(e: MouseEvent) {
    // 스킨·변형 유닛은 기본 유닛의 조합식을 보여 준다
    const recipe = recipeOf(unit.id) ?? recipeOf(base(unit.id));
    showHover(buildHover(unit, { label, note, tier }, recipe, unitName, combo), e.clientX, e.clientY);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="row" class:owned={count > 0} class:ready={combo?.craftable} class:dimmed onmouseenter={enter} onmousemove={(e) => moveHover(e.clientX, e.clientY)} onmouseleave={hideHover}>
  <UnitIcon id={unit.id} name={unit.name} size={16} />
  {#if unit.grade}<span class="grade g-{unit.grade}">{GRADE_SHORT[unit.grade] ?? unit.grade}</span>{/if}
  {#if pct > 0}<span class="pct">{pct}%</span>{/if}
  <span class="cell">
    {#if pct > 0}<span class="fill" style:width={`${pct}%`}></span>{/if}
    {#if tier}<span class="tier t-{tier.replace('+', 'p')}">({tier})</span>{/if}
    <span class="nm">{label ?? unit.name}</span>
    {#each badges as b, i (i)}{#if BADGE[b]}<span class="badge {b}"><Icon name={BADGE[b]} size={9} /></span>{/if}{/each}
    {#if note}<span class="stat">({note})</span>{/if}
  </span>
  <span class="ctl">
    {#if adjustable}
      <button type="button" aria-label="추가" onclick={() => onadjust(1)}>+</button>
      <button type="button" aria-label="제거" onclick={() => onadjust(-1)} disabled={count === 0}>−</button>
    {/if}
    <span class="cnt" class:zero={count === 0}>{count}</span>
  </span>
</div>

<style>
  .row { display: flex; align-items: center; gap: 2px; height: 20px; padding: 0 2px 0 3px; font-size: 9px; color: var(--c-text-2); border-bottom: 1px solid var(--c-border-row); }
  .row:hover { background: var(--c-bg-hover); color: var(--c-text); }
  .row.owned { color: var(--c-text); background: var(--c-accent-soft); }
  .row.ready .nm { color: var(--c-ok-text); font-weight: 600; }
  .row.dimmed { opacity: 0.28; }
  .grade { flex: none; min-width: 11px; padding: 0 2px; border-radius: 2px; font-size: 8px; line-height: 12px; text-align: center; color: var(--c-bg-app); background: var(--c-text-3); }
  .g-흔함, .g-안흔함 { background: var(--c-tier-1); } .g-특별, .g-희귀 { background: var(--c-tier-2); } .g-전설, .g-히든, .g-변화, .g-해적선 { background: var(--c-tier-3); }
  .g-제한, .g-랜덤전용, .g-신비, .g-왜곡, .g-특수 { background: var(--c-tier-4); } .g-초월, .g-불멸, .g-영원, .g-세라핌, .g-오로성 { background: var(--c-tier-5); }
  .cell { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; height: 100%; overflow: hidden; }
  .fill { position: absolute; left: 0; top: 2px; bottom: 2px; background: color-mix(in srgb, var(--c-accent) 22%, transparent); border-radius: 2px; }
  .ready .fill { background: color-mix(in srgb, var(--c-ok) 26%, transparent); }
  .tier { position: relative; flex: none; font-size: 8px; font-weight: 700; color: var(--c-text-3); }
  .t-S { color: var(--c-danger-text); } .t-Ap, .t-A { color: var(--c-warn-text); } .t-B { color: var(--c-accent-text); } .t-C { color: var(--c-ok-text); }
  .nm { position: relative; white-space: nowrap; flex: none; }
  .badge { position: relative; display: inline-flex; flex: none; }
  .badge.flag { color: var(--c-danger); } .badge.sword { color: var(--c-text-2); }
  .badge.heart-blue { color: var(--c-accent-text); } .badge.heart-red { color: var(--c-danger-text); } .badge.heart-white { color: var(--c-text); } .badge.plus { color: var(--c-text); }
  /* 요약만 줄어든다 (이름·배지는 항상 보임) */
  .stat { position: relative; flex: 1 1 0; min-width: 0; color: var(--c-text-3); font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 조합 진행도: 등급과 이름 사이, 숫자가 있을 때만 자리를 차지한다 */
  .pct { flex: none; font-size: 8px; color: var(--c-accent-text); font-variant-numeric: tabular-nums; }
  .ready .pct { color: var(--c-ok-text); }
  .ctl { display: inline-flex; align-items: center; gap: 1px; flex: none; }
  .ctl button { width: 14px; height: 14px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 10px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .cnt { min-width: 16px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--c-accent-text); }
  .cnt.zero { color: var(--c-text-3); font-weight: 400; }
</style>

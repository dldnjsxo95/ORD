<!-- 유닛 한 행(20px): 초상(16px) · 이름 · 역할 배지 · (스탯 요약) · [+] [−] 수량.
     이름 칸은 조합 진행도만큼 채워지는 게이지, 조합 가능하면 초록. 필터가 켜져 있고 안 맞으면 흐리게. -->
<script lang="ts">
  import type { Unit, ComboStatus } from '$lib/api';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import type { IconName } from '$lib/ui/icons';

  interface Props {
    unit: Unit;
    count: number;
    combo?: ComboStatus;
    dimmed?: boolean;
    uncertain?: boolean;
    onadjust: (delta: number) => void;
  }
  let { unit, count, combo, dimmed = false, uncertain = false, onadjust }: Props = $props();

  const BADGE: Record<string, IconName> = { flag: 'flag', sword: 'sword', heart: 'heart', plus: 'plusCircle' };
  const pct = $derived(combo && combo.need ? Math.round((combo.have / combo.need) * 100) : 0);
  const tip = $derived(
    [unit.grade ? `${unit.name} (${unit.grade})` : unit.name, unit.title, unit.damageType, unit.tags?.length ? unit.tags.join(', ') : null, combo ? (combo.craftable ? '지금 조합 가능' : `재료 ${combo.have}/${combo.need}`) : null]
      .filter(Boolean)
      .join('\n'),
  );
</script>

<div class="row" class:owned={count > 0} class:ready={combo?.craftable} class:dimmed title={tip}>
  <UnitIcon id={unit.id} name={unit.name} size={16} />
  <span class="cell">
    {#if pct > 0}<span class="fill" style:width={`${pct}%`}></span>{/if}
    <span class="nm">{unit.name}</span>
    {#if uncertain}<span class="q" title="물딜/마딜 미분류 (임시로 마딜에 둠)">?</span>{/if}
    {#each unit.badges ?? [] as b}{#if BADGE[b]}<span class="badge {b}"><Icon name={BADGE[b]} size={10} /></span>{/if}{/each}
    {#if unit.statText}<span class="stat">({unit.statText})</span>{/if}
    {#if pct > 0}<span class="pct">{pct}%</span>{/if}
  </span>
  <span class="ctl">
    <button type="button" aria-label="추가" onclick={() => onadjust(1)}>+</button>
    <button type="button" aria-label="제거" onclick={() => onadjust(-1)} disabled={count === 0}>−</button>
    <span class="cnt" class:zero={count === 0}>{count}</span>
  </span>
</div>

<style>
  .row { display: flex; align-items: center; gap: 4px; height: 20px; padding: 0 2px 0 3px; font-size: 11px; color: var(--c-text-2); border-bottom: 1px solid var(--c-border-row); }
  .row:hover { background: var(--c-bg-hover); color: var(--c-text); }
  .row.owned { color: var(--c-text); background: var(--c-accent-soft); }
  .row.ready .nm { color: var(--c-ok-text); font-weight: 600; }
  .row.dimmed { opacity: 0.28; }
  .cell { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 3px; height: 100%; overflow: hidden; }
  .fill { position: absolute; left: 0; top: 2px; bottom: 2px; background: color-mix(in srgb, var(--c-accent) 22%, transparent); border-radius: 2px; }
  .ready .fill { background: color-mix(in srgb, var(--c-ok) 26%, transparent); }
  .nm { position: relative; white-space: nowrap; flex: none; }
  .q { position: relative; color: var(--c-warn-text); font-weight: 700; }
  .badge { position: relative; display: inline-flex; flex: none; color: var(--c-text-3); }
  .badge.flag { color: var(--c-accent-text); } .badge.sword { color: var(--c-danger-text); } .badge.heart { color: var(--c-ok-text); } .badge.plus { color: var(--c-warn-text); }
  /* 스탯 요약만 줄어든다 (이름·배지·퍼센트는 항상 보임) */
  .stat { position: relative; flex: 1 1 0; min-width: 0; color: var(--c-text-3); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pct { position: relative; margin-left: auto; padding-right: 3px; flex: none; font-size: 10px; color: var(--c-accent-text); font-variant-numeric: tabular-nums; }
  .ready .pct { color: var(--c-ok-text); }
  .ctl { display: inline-flex; align-items: center; gap: 1px; flex: none; }
  .ctl button { width: 16px; height: 16px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 11px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .cnt { min-width: 16px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--c-accent-text); }
  .cnt.zero { color: var(--c-text-3); font-weight: 400; }
</style>

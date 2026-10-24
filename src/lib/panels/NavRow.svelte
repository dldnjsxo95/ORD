<!-- 항법 한 행(20px, 한 줄): 아이콘 · (티어)이름 · 속한 항법. 호버 = 효과 설명 + 메모, 클릭 = 메모 편집(NavDetail). -->
<script lang="ts">
  import type { Entry } from '$lib/layout';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import { showHover, moveHover, hideHover } from '$lib/stores/hover.svelte';
  import { infoCard } from '$lib/actions/hover';
  import { memoOf } from '$lib/stores/memo.svelte';
  import { openDetail } from '$lib/stores/detail.svelte';

  let { entry }: { entry: Entry } = $props();
  const id = $derived(entry.id ?? '');
  const hasMemo = $derived(!!memoOf(id));

  function enter(e: MouseEvent) {
    const lines = (entry.desc ?? []).map((d) => (d.startsWith('페널티') ? { text: d, warn: true } : d.startsWith('항법 기본효과') ? { text: d, muted: true } : d));
    const content = infoCard(`${entry.group ? `${entry.group} : ` : ''}${entry.label}${entry.tier ? ` (${entry.tier})` : ''}`, lines);
    const m = memoOf(id);
    if (m) content.memo = m;
    showHover(content, e.clientX, e.clientY);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="row" class:memo={hasMemo} onmouseenter={enter} onmousemove={(e) => moveHover(e.clientX, e.clientY)} onmouseleave={hideHover} onclick={() => openDetail(id)}>
  <span class="open"><UnitIcon {id} name={entry.label ?? ''} size={16} /></span>
  <span class="cell">
    {#if entry.group}<span class="grp">{entry.group} :</span>{/if}
    <span class="nm">{entry.label}</span>
    {#if entry.tier}<span class="tier t-{entry.tier.replace('+', 'p')}">({entry.tier})</span>{/if}
  </span>
</div>

<style>
  .row { display: flex; align-items: center; gap: 3px; height: 20px; padding: 0 2px 0 3px; font-size: 9px; color: var(--c-row-text); border-bottom: 1px solid var(--c-border-row); cursor: pointer; }
  .row:hover { background: var(--c-bg-hover); }
  .row.memo .nm { text-decoration: underline dotted var(--c-warn-text); text-underline-offset: 2px; }
  .open { display: inline-flex; flex: none; }
  .cell { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; overflow: hidden; }
  .tier { flex: none; font-size: 8px; font-weight: 700; color: var(--c-text-3); }
  .t-S { color: var(--c-danger-text); } .t-Ap, .t-A { color: var(--c-warn-text); } .t-B { color: var(--c-accent-text); } .t-C { color: var(--c-ok-text); }
  .grp { flex: none; color: var(--c-row-text); white-space: nowrap; }
  .nm { white-space: nowrap; flex: none; }
  .stat { flex: 1 1 0; min-width: 0; color: var(--c-row-text-2); font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>

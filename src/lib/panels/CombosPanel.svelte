<!-- 조합 뷰: 지금 가능한 조합과 진행 중인 조합(부족 재료). -->
<script lang="ts">
  import { game, unitName, unitTier } from '$lib/stores/game.svelte';
  import Pill from '$lib/ui/Pill.svelte';

  const craftable = $derived(game.payload?.combos.filter((c) => c.craftable) ?? []);
  const pending = $derived(game.payload?.combos.filter((c) => !c.craftable) ?? []);
</script>

<div class="panel">
  <p class="panel-sub cat first">조합 가능 <span class="count">{craftable.length}</span></p>
  {#if craftable.length === 0}
    <p class="empty">지금 바로 만들 수 있는 조합이 없습니다.</p>
  {:else}
    <ul class="list">
      {#each craftable as c (c.result)}
        <li class="row ready">
          <span class="tier t{unitTier(c.result)}"></span>
          <span class="name">{c.result_name || c.result}</span>
          <span class="code mono">{c.result}</span>
          <span class="spacer"></span>
          <Pill tone="ok" square>준비됨</Pill>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="panel-sub cat">진행 중 <span class="count">{pending.length}</span></p>
  {#if pending.length === 0}
    <p class="empty">—</p>
  {:else}
    <ul class="list">
      {#each pending as c (c.result)}
        <li class="row">
          <span class="tier t{unitTier(c.result)}"></span>
          <span class="name">{c.result_name || c.result}</span>
          <span class="code mono">{c.result}</span>
          <span class="spacer"></span>
          <span class="progress mono">{c.have}/{c.need}</span>
          <span class="bar"><span class="fill" style:width={`${c.need ? (c.have / c.need) * 100 : 0}%`}></span></span>
          <span class="missing">
            {#each c.missing as m (m.unit)}
              <Pill square title={m.unit}>{unitName(m.unit)} ×{m.count}</Pill>
            {/each}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .count { color: var(--c-text); margin-left: var(--sp-1); }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-3); padding: 4px var(--sp-2); border-bottom: 1px solid var(--c-border-row); min-height: 24px; }
  .row:hover { background: var(--c-bg-hover); }
  .row.ready .name { color: var(--c-ok-text); }
  .tier { width: 3px; height: 16px; border-radius: 1px; background: var(--c-border-strong); flex: none; }
  .t1 { background: var(--c-tier-1); } .t2 { background: var(--c-tier-2); } .t3 { background: var(--c-tier-3); } .t4 { background: var(--c-tier-4); } .t5 { background: var(--c-tier-5); }
  .name { white-space: nowrap; }
  .code { color: var(--c-text-3); font-size: var(--fs-1); }
  .progress { color: var(--c-text-2); font-size: var(--fs-2); }
  .bar { width: 80px; height: 4px; background: var(--c-bg-input); border-radius: 2px; overflow: hidden; flex: none; }
  .fill { display: block; height: 100%; background: var(--c-accent); transition: width var(--dur-2) var(--ease); }
  .missing { display: inline-flex; gap: var(--sp-1); flex-wrap: wrap; justify-content: flex-end; }
</style>

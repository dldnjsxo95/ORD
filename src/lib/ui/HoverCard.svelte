<!-- 유닛 호버 카드: 조합식 → 구분선 → 특징. 마우스를 따라다니며 화면 밖으로 나가지 않게 위치를 조정한다. -->
<script lang="ts">
  import { hover } from '$lib/stores/hover.svelte';

  let el: HTMLDivElement | undefined = $state();
  const pos = $derived.by(() => {
    const pad = 14;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 120;
    let x = hover.x + pad;
    let y = hover.y + pad;
    if (typeof window !== 'undefined') {
      if (x + w > window.innerWidth - 8) x = hover.x - w - pad;
      if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    }
    return { x: Math.max(4, x), y: Math.max(4, y) };
  });
</script>

{#if hover.content}
  <div class="card" bind:this={el} style:left={`${pos.x}px`} style:top={`${pos.y}px`} role="tooltip">
    <div class="title">{hover.content.title}</div>
    {#each hover.content.recipe as line, i (i)}<div class="line" class:done={line.done}>{line.text}</div>{/each}
    <div class="sep"></div>
    {#if hover.content.features.length === 0}
      <div class="line muted">특징 정보 없음</div>
    {/if}
    {#each hover.content.features as line, i (i)}<div class="line">{line}</div>{/each}
  </div>
{/if}

<style>
  .card {
    position: fixed; z-index: 1000; min-width: 180px; max-width: 320px; padding: 6px 10px; pointer-events: none;
    background: var(--c-bg-panel); border: 1px solid var(--c-border-strong); border-radius: var(--r-3); box-shadow: var(--shadow-pop);
    font-size: 12px; line-height: 18px; color: var(--c-text);
  }
  .title { color: var(--c-accent-text); font-weight: 600; margin-bottom: 2px; }
  .line { white-space: nowrap; }
  .muted { color: var(--c-text-3); }
  .done { color: var(--c-text-3); text-decoration: line-through; }
  .sep { border-top: 1px dashed var(--c-border-strong); margin: 4px 0; }
</style>

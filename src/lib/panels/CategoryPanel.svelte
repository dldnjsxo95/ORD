<!-- 등급 카테고리 패널: 헤더(이름 · 전체선택 · 접기) + 유닛 행 목록. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { plan, toggleCollapsed } from '$lib/stores/plan.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  interface Props {
    id: string;
    title: string;
    count?: number;
    /** 전체선택 상태와 핸들러 (units 패널만) */
    allOn?: boolean;
    onall?: (on: boolean) => void;
    children: Snippet;
  }
  let { id, title, count, allOn = false, onall, children }: Props = $props();
  const collapsed = $derived(!!plan.collapsed[id]);
</script>

<section class="cat" class:collapsed>
  <header class="head">
    <button type="button" class="title" onclick={() => toggleCollapsed(id)}>
      {title}{#if count != null}<small>{count}</small>{/if}
    </button>
    {#if onall}
      <input type="checkbox" class="all" title="전체선택" checked={allOn} onchange={(e) => onall?.((e.currentTarget as HTMLInputElement).checked)} />
    {/if}
    <button type="button" class="chev" aria-label={collapsed ? '펼치기' : '접기'} onclick={() => toggleCollapsed(id)}>
      <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={12} />
    </button>
  </header>
  {#if !collapsed}
    <div class="body">{@render children()}</div>
  {/if}
</section>

<style>
  .cat { border: 1px solid var(--c-border); border-radius: var(--r-1); background: var(--c-bg-panel); }
  .head { display: flex; align-items: center; height: 20px; padding: 0 2px 0 4px; background: var(--c-bg-app); border-bottom: 1px solid var(--c-border); }
  .collapsed .head { border-bottom: 0; }
  .title { flex: 1; text-align: left; border: 0; background: none; color: var(--c-accent-text); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title small { color: var(--c-text-3); font-weight: 400; margin-left: 4px; }
  .all { margin: 0 2px; width: 12px; height: 12px; accent-color: var(--c-accent); }
  .chev { border: 0; background: none; color: var(--c-text-3); padding: 0 2px; cursor: pointer; display: inline-flex; }
  .chev:hover { color: var(--c-text); }
  .body { display: flex; flex-direction: column; }
</style>

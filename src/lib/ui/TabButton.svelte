<!-- 영역 탭 (하단 패널 등): 작은 대문자 라벨, 활성 시 강조색 밑줄. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props { active?: boolean; onclick?: (e: MouseEvent) => void; children: Snippet }
  let { active = false, onclick, children }: Props = $props();
</script>

<button class="ui-tab" class:active type="button" role="tab" aria-selected={active} {onclick}>
  {@render children()}
</button>

<style>
  .ui-tab {
    display: inline-flex; align-items: center; height: 100%; padding: 0 var(--sp-2); margin: 0 var(--sp-2);
    border: 0; border-bottom: 1px solid transparent; background: none; cursor: pointer; font: inherit;
    font-size: var(--fs-1); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-3); white-space: nowrap;
    transition: color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
  }
  .ui-tab:hover { color: var(--c-text); }
  .ui-tab.active { color: var(--c-text); border-bottom-color: var(--c-accent); }
  .ui-tab:focus-visible { outline: 1px solid var(--c-focus); outline-offset: -1px; }
</style>

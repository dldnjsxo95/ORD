<!-- 아이콘 전용 버튼. label 은 필수이며 접근성 이름과 툴팁이 된다. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    icon?: IconName;
    children?: Snippet;
    label: string;
    size?: 'sm' | 'md';
    active?: boolean;
    disabled?: boolean;
    variant?: 'ghost' | 'danger' | 'titlebar';
    onclick?: (e: MouseEvent) => void;
  }
  let { icon, children, label, size = 'md', active = false, disabled = false, variant = 'ghost', onclick }: Props = $props();
</script>

<button class="ui-iconbtn {size} {variant}" class:active type="button" aria-label={label} title={label} aria-pressed={active || undefined} {disabled} {onclick}>
  {#if children}{@render children()}{:else if icon}<Icon name={icon} size={size === 'sm' ? 14 : 16} />{/if}
</button>

<style>
  .ui-iconbtn {
    display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--r-2);
    cursor: pointer; color: var(--c-text-2); background: transparent; padding: var(--sp-1); line-height: 0;
    transition: background-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }
  .ui-iconbtn.md { width: 26px; height: 26px; }
  .ui-iconbtn.sm { width: 20px; height: 20px; }
  .ui-iconbtn:hover { background: var(--c-bg-raised); color: var(--c-text); }
  .ui-iconbtn.active { background: var(--c-accent-soft); color: var(--c-accent-text); }
  .ui-iconbtn.danger { color: var(--c-danger-text); }
  .ui-iconbtn.titlebar { color: var(--c-titlebar-fg); }
  .ui-iconbtn.titlebar:hover { background: var(--c-bg-raised); color: var(--c-text); }
  .ui-iconbtn:disabled { opacity: 0.45; cursor: default; }
  .ui-iconbtn:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 1px; }
</style>

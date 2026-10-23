<!-- UI 계층의 유일한 버튼. VS Code 형태: 평면, 2px 라운드, 강조색 하나. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    variant?: 'primary' | 'ghost' | 'danger' | 'active';
    size?: 'sm' | 'md';
    icon?: IconName;
    disabled?: boolean;
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }
  let { variant = 'primary', size = 'md', icon, disabled = false, title, onclick, children }: Props = $props();
</script>

<button class="ui-btn {variant} {size}" type="button" {disabled} {title} {onclick}>
  {#if icon}<span class="ic"><Icon name={icon} size={size === 'sm' ? 13 : 15} /></span>{/if}
  <span class="lbl">{@render children()}</span>
</button>

<style>
  .ui-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
    border: 1px solid transparent; border-radius: var(--r-1); cursor: pointer; font: inherit; font-weight: 400; line-height: 18px;
    color: var(--c-text); background: var(--c-bg-input); padding: 3px var(--sp-5); white-space: nowrap;
    transition: background-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
  }
  .primary { color: var(--c-accent-text); border-color: color-mix(in srgb, var(--c-accent) 60%, transparent); }
  .primary:hover:not(:disabled) { background: var(--c-bg-raised); border-color: var(--c-accent); }
  .ghost { border-color: var(--c-border-strong); }
  .ghost:hover:not(:disabled) { background: var(--c-bg-raised); }
  .danger { color: var(--c-danger-text); border-color: color-mix(in srgb, var(--c-danger) 60%, transparent); }
  .danger:hover:not(:disabled) { background: var(--c-bg-raised); border-color: var(--c-danger); }
  .active { background: var(--c-accent-soft); color: var(--c-accent-text); border-color: var(--c-accent); }
  .sm { padding: 1px var(--sp-3); font-size: var(--fs-2); line-height: 16px; }
  .ui-btn:disabled { opacity: 0.4; cursor: default; }
  .ui-btn:focus-visible { outline: 1px solid var(--c-focus); outline-offset: 1px; }
  .ic { display: inline-flex; opacity: 0.85; }
  .lbl { display: inline-flex; align-items: center; gap: var(--sp-2); }
</style>

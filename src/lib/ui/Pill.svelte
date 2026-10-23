<!-- 작은 상태 칩. 톤이 의미를 담고, 텍스트도 같은 뜻을 말한다. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

  interface Props { tone?: Tone; square?: boolean; title?: string; children: Snippet }
  let { tone = 'neutral', square = false, title, children }: Props = $props();
</script>

<span class="ui-pill {tone}" class:square {title}>{@render children()}</span>

<style>
  .ui-pill {
    display: inline-block; font-size: var(--fs-1); font-weight: 500; padding: 0 var(--sp-3); border-radius: 9px; line-height: 17px;
    border: 1px solid var(--c-border-strong); color: var(--c-text-2); background: var(--c-bg-input); white-space: nowrap;
  }
  .ui-pill.square { border-radius: var(--r-1); padding: 0 var(--sp-2); }
  .ok { border-color: transparent; background: color-mix(in srgb, var(--c-ok) 22%, transparent); color: var(--c-ok-text); }
  .warn { border-color: transparent; background: color-mix(in srgb, var(--c-warn) 22%, transparent); color: var(--c-warn-text); }
  .danger { border-color: transparent; background: color-mix(in srgb, var(--c-danger) 22%, transparent); color: var(--c-danger-text); }
  .info { border-color: transparent; background: var(--c-accent-soft); color: var(--c-accent-text); }
</style>

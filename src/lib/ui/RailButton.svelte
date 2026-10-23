<!-- 액티비티 바(세로 레일)용 아이콘 버튼. 왼쪽 2px 레일이 'on' 일 때 강조색으로 그려진다. -->
<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    icon: IconName;
    label: string;
    state?: 'on' | 'off';
    size?: number;
    onclick?: () => void;
  }
  let { icon, label, state: railState = 'off', size = 20, onclick }: Props = $props();
</script>

<button type="button" class="ui-rail {railState}" aria-label={label} title={label} {onclick}>
  <Icon name={icon} {size} />
</button>

<style>
  .ui-rail {
    position: relative; display: flex; align-items: center; justify-content: center; width: var(--activitybar-w); height: var(--activitybar-w);
    border: 0; background: transparent; color: var(--c-text-3); cursor: pointer; transition: color var(--dur-1) var(--ease);
  }
  .ui-rail:hover, .ui-rail.on { color: var(--c-text); }
  .ui-rail::before { content: ''; position: absolute; left: 0; top: 50%; bottom: 50%; width: 2px; background: var(--c-accent); transition: top var(--dur-2) var(--ease), bottom var(--dur-2) var(--ease); }
  .ui-rail.on::before { top: 10px; bottom: 10px; }
  .ui-rail:focus-visible { outline: 1px solid var(--c-focus); outline-offset: -1px; }
</style>

<script lang="ts">
  import { ICONS, type IconName } from './icons';

  interface Props { name: IconName; size?: number }
  let { name, size = 16 }: Props = $props();
</script>

<svg class="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={ICONS[name]} />
</svg>

<style>
  .ui-icon { display: inline-block; vertical-align: -0.15em; flex: none; }
</style>

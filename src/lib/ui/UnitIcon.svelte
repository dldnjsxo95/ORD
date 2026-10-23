<!-- 유닛 초상화. static/icons/<id>.png 가 없으면 이름 첫 글자로 대체한다. -->
<script lang="ts">
  interface Props { id: string; name: string; size?: number }
  let { id, name, size = 24 }: Props = $props();
  let failed = $state(false);
</script>

{#if failed}
  <span class="ui-unit-icon fallback" style:width={`${size}px`} style:height={`${size}px`} style:font-size={`${Math.round(size * 0.45)}px`} aria-hidden="true">{name.slice(0, 1)}</span>
{:else}
  <img class="ui-unit-icon" src={`/icons/${id}.png`} alt="" width={size} height={size} loading="lazy" draggable="false" onerror={() => (failed = true)} />
{/if}

<style>
  .ui-unit-icon { display: inline-block; flex: none; border-radius: var(--r-1); background: var(--c-bg-input); object-fit: cover; }
  .fallback { display: inline-flex; align-items: center; justify-content: center; color: var(--c-text-3); font-weight: 600; }
</style>

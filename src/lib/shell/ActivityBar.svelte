<!-- VS Code 식 액티비티 바: 뷰 하나당 아이콘 하나. 클릭하면 가운데 영역이 그 뷰로 바뀐다. -->
<script lang="ts">
  import { ui, setView, VIEWS, type ViewId } from '$lib/stores/ui.svelte';
  import RailButton from '$lib/ui/RailButton.svelte';

  const ids = Object.keys(VIEWS) as ViewId[];
</script>

<nav class="activity" aria-label="뷰">
  <ul>
    {#each ids as id (id)}
      <li>
        <RailButton icon={VIEWS[id].icon} label={VIEWS[id].title} state={ui.view === id ? 'on' : 'off'} onclick={() => setView(id)} />
      </li>
    {/each}
  </ul>
</nav>

<style>
  .activity { width: var(--activitybar-w); flex: none; display: flex; flex-direction: column; background: var(--c-bg-app); border-right: 1px solid var(--c-border); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
</style>

<!-- VS Code 식 상태 표시줄 (22px, 하단): 감시 상태, 맵, 골드, 유닛 수, 조합 가능 수. 읽기 전용. -->
<script lang="ts">
  import { game, ownedTotal, craftableCount } from '$lib/stores/game.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  const state = $derived(game.payload?.state ?? null);
</script>

<footer class="statusbar">
  <span class="item" class:ok={game.watching} class:muted={!game.watching} title={game.watching ? `감시 중: ${game.dir}` : '감시 중지됨'}>
    <span class="dot"></span>{game.watching ? '감시 중' : '중지됨'}
  </span>
  {#if state}
    <span class="item" title="맵"><Icon name="folder" size={12} /> {state.map || '(맵 이름 없음)'}</span>
    <span class="item mono" title="골드"><Icon name="coins" size={12} /> {state.gold.toLocaleString()}</span>
    {#if state.wood != null}<span class="item mono" title="목재"><Icon name="flask" size={12} /> {state.wood}</span>{/if}
    <span class="item" title="보유 유닛"><Icon name="cube" size={12} /> 유닛 {ownedTotal()}</span>
    <span class="item" class:ok={craftableCount() > 0} title="지금 조합 가능"><Icon name="layers" size={12} /> 조합 {craftableCount()}</span>
    <span class="item muted" title="마지막 갱신"><Icon name="clock" size={12} /> {game.lastAt}</span>
  {:else}
    <span class="item muted">state.json 을 기다리는 중</span>
  {/if}
  <span class="spacer"></span>
  {#if game.error}
    <span class="item danger" title={game.error}><Icon name="warning" size={12} /> {game.error}</span>
  {/if}
</footer>

<style>
  .statusbar {
    display: flex; align-items: center; gap: 2px; height: var(--statusbar-h); padding: 0 var(--sp-3); flex: none; overflow: hidden;
    background: var(--c-bg-app); border-top: 1px solid var(--c-border); font-size: var(--fs-2); color: var(--c-text-2);
  }
  .item { display: inline-flex; align-items: center; gap: var(--sp-1); padding: 0 var(--sp-2); height: 100%; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .item:hover { background: var(--c-bg-hover); }
  .muted { color: var(--c-text-3); }
  .ok { color: var(--c-ok-text); }
  .danger { color: var(--c-danger-text); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
</style>

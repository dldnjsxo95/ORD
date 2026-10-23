<!-- 유닛 뷰: 보유 유닛 표와 조합 DB 의 전체 유닛 목록. -->
<script lang="ts">
  import { game, unitName, unitTier, ownedTotal } from '$lib/stores/game.svelte';

  const owned = $derived(
    Object.entries(game.payload?.state.units ?? {}).sort(([a], [b]) => unitTier(b) - unitTier(a) || a.localeCompare(b)),
  );
  const all = $derived([...(game.db?.units ?? [])].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id)));
</script>

<div class="panel">
  <p class="panel-sub cat first">보유 유닛 <span class="count">{ownedTotal()}</span></p>
  {#if owned.length === 0}
    <p class="empty">보유 유닛이 없습니다.</p>
  {:else}
    <table class="data-table">
      <thead><tr><th>등급</th><th>이름</th><th>코드</th><th class="num">수량</th></tr></thead>
      <tbody>
        {#each owned as [id, n] (id)}
          <tr>
            <td><span class="tier t{unitTier(id)}">{unitTier(id) || '?'}</span></td>
            <td>{unitName(id)}</td>
            <td class="mono code">{id}</td>
            <td class="num mono">{n}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <p class="panel-sub cat">조합 DB <span class="count">{all.length}</span> <span class="hint">v{game.db?.version ?? '-'}</span></p>
  <table class="data-table">
    <thead><tr><th>등급</th><th>이름</th><th>코드</th></tr></thead>
    <tbody>
      {#each all as u (u.id)}
        <tr>
          <td><span class="tier t{u.tier}">{u.tier}</span></td>
          <td>{u.name}</td>
          <td class="mono code">{u.id}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .count { color: var(--c-text); margin-left: var(--sp-1); }
  .hint { margin-left: var(--sp-2); text-transform: none; font-weight: 400; }
  .code { color: var(--c-text-3); }
  .tier { display: inline-block; min-width: 16px; text-align: center; font-size: var(--fs-1); font-weight: 600; border-radius: var(--r-1); padding: 0 4px; color: var(--c-bg-app); background: var(--c-border-strong); }
  .t1 { background: var(--c-tier-1); } .t2 { background: var(--c-tier-2); } .t3 { background: var(--c-tier-3); } .t4 { background: var(--c-tier-4); } .t5 { background: var(--c-tier-5); }
</style>

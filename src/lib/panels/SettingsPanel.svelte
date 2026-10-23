<!-- 설정 뷰: 감시 폴더, 테마, 정보. -->
<script lang="ts">
  import { ui, setTheme } from '$lib/stores/ui.svelte';
  import { game, startWatch, stopWatch } from '$lib/stores/game.svelte';
  import Button from '$lib/ui/Button.svelte';
</script>

<div class="panel">
  <p class="panel-sub cat first">데이터 소스</p>
  <div class="setting">
    <div class="label">감시 폴더 <span class="hint">state.json 이 기록되는 위치</span></div>
    <div class="control">
      <input class="mono" type="text" bind:value={game.dir} disabled={game.watching} spellcheck="false" />
      {#if game.watching}
        <Button variant="ghost" onclick={() => void stopWatch()}>중지</Button>
      {:else}
        <Button onclick={() => void startWatch()}>시작</Button>
      {/if}
    </div>
  </div>

  <p class="panel-sub cat">화면</p>
  <div class="setting">
    <div class="label">테마</div>
    <div class="control">
      <Button size="sm" variant={ui.theme === 'dark' ? 'active' : 'ghost'} onclick={() => setTheme('dark')}>어두운</Button>
      <Button size="sm" variant={ui.theme === 'light' ? 'active' : 'ghost'} onclick={() => setTheme('light')}>밝은</Button>
    </div>
  </div>

  <p class="panel-sub cat">정보</p>
  <div class="setting">
    <div class="label">조합 DB</div>
    <div class="control hint">v{game.db?.version ?? '-'} · 유닛 {game.db?.units.length ?? 0}종 · 조합식 {game.db?.recipes.length ?? 0}개</div>
  </div>
  <div class="setting">
    <div class="label">데이터 흐름</div>
    <div class="control hint">TMO.GG Desktop → scripts/ord-export.lua → state.json → 이 앱</div>
  </div>
</div>

<style>
  .setting { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-2) 0; border-bottom: 1px solid var(--c-border-row); }
  .label { width: 160px; flex: none; }
  .label .hint { display: block; }
  .control { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 0; }
  input {
    flex: 1; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 var(--sp-3); font-size: var(--fs-2);
    color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1);
  }
  input:focus { outline: 1px solid var(--c-focus); outline-offset: -1px; }
  input:disabled { color: var(--c-text-2); }
</style>

<!-- 설정 뷰: 감시 폴더(바꾸면 즉시 반영), 테마, 정보. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ui, setTheme } from '$lib/stores/ui.svelte';
  import { game, changeDir, defaultDir } from '$lib/stores/game.svelte';
  import Button from '$lib/ui/Button.svelte';

  let draft = $state('');
  let fallback = $state('');
  onMount(async () => {
    fallback = await defaultDir();
  });
  // 바깥(초기화 등)에서 폴더가 바뀌면 입력 칸도 따라간다.
  $effect(() => {
    draft = game.dir;
  });

  async function apply() {
    if (draft.trim() === game.dir) return;
    await changeDir(draft);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === 'Escape') draft = game.dir;
  }
</script>

<div class="panel">
  <p class="panel-sub cat first">데이터 소스</p>
  <div class="setting">
    <div class="label">감시 폴더 <span class="hint">state.json 이 기록되는 위치. 바꾸면 바로 적용됩니다.</span></div>
    <div class="control">
      <input class="mono" type="text" bind:value={draft} onblur={apply} onkeydown={onKey} spellcheck="false" placeholder={fallback} />
      <Button size="sm" variant="ghost" disabled={!game.dir || game.dir === fallback} title={fallback} onclick={() => void changeDir('')}>기본값</Button>
    </div>
  </div>
  <div class="setting">
    <div class="label">상태</div>
    <div class="control">
      <span class="dot" class:on={game.watching}></span>
      <span class="hint">{game.watching ? `감시 중 · ${game.dir}` : '감시가 시작되지 않았습니다'}</span>
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
  .label { width: 200px; flex: none; }
  .label .hint { display: block; }
  .control { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 0; }
  input {
    flex: 1; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 var(--sp-3); font-size: var(--fs-2);
    color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1);
  }
  input:focus { outline: 1px solid var(--c-focus); outline-offset: -1px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-text-3); flex: none; }
  .dot.on { background: var(--c-ok-text); }
</style>

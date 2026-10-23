<!-- 메인 창, VS Code 셸: 타이틀바; 액티비티 바 + [뷰 위 하단 패널]; 상태 표시줄. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { ui, setBottomVisible, VIEWS } from '$lib/stores/ui.svelte';
  import { initGame, disposeGame } from '$lib/stores/game.svelte';
  import TopBar from '$lib/shell/TopBar.svelte';
  import ActivityBar from '$lib/shell/ActivityBar.svelte';
  import StatusBar from '$lib/shell/StatusBar.svelte';
  import BottomPanel from '$lib/shell/BottomPanel.svelte';
  import CombosPanel from '$lib/panels/CombosPanel.svelte';
  import UnitsPanel from '$lib/panels/UnitsPanel.svelte';
  import SettingsPanel from '$lib/panels/SettingsPanel.svelte';

  onMount(() => {
    void initGame();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setBottomVisible(!ui.bottomVisible);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  onDestroy(disposeGame);
</script>

<main>
  <TopBar />
  <div class="body">
    <ActivityBar />
    <div class="center">
      <section class="view">
        <header class="view-head"><span class="view-title">{VIEWS[ui.view].title}</span></header>
        <div class="view-body">
          {#if ui.view === 'combos'}<CombosPanel />
          {:else if ui.view === 'units'}<UnitsPanel />
          {:else}<SettingsPanel />{/if}
        </div>
      </section>
      <BottomPanel />
    </div>
  </div>
  <StatusBar />
</main>

<style>
  main { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .body { display: flex; flex: 1; min-height: 0; }
  .center { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
  .view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--c-bg-panel); }
  .view-head { display: flex; align-items: center; height: var(--tab-h); padding: 0 var(--sp-5); flex: none; border-bottom: 1px solid var(--c-border); }
  .view-title { font-size: var(--fs-1); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-2); }
  .view-body { flex: 1; min-height: 0; overflow: auto; }
</style>

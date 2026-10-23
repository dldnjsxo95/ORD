<!-- 메인 창, VS Code 셸: 타이틀바; 액티비티 바 + [뷰 위 하단 패널]; 상태 표시줄.
     전체화면에서는 타이틀바를 숨기고 ESC 로 해제한다. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { ui, setBottomVisible } from '$lib/stores/ui.svelte';
  import { initGame, disposeGame, pushLog } from '$lib/stores/game.svelte';
  import { fullscreen, syncFullscreen, exitFullscreen } from '$lib/stores/fullscreen.svelte';
  import TopBar from '$lib/shell/TopBar.svelte';
  import ActivityBar from '$lib/shell/ActivityBar.svelte';
  import StatusBar from '$lib/shell/StatusBar.svelte';
  import BottomPanel from '$lib/shell/BottomPanel.svelte';
  import MainPanel from '$lib/panels/MainPanel.svelte';
  import SettingsPanel from '$lib/panels/SettingsPanel.svelte';

  onMount(() => {
    void initGame();
    void syncFullscreen();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setBottomVisible(!ui.bottomVisible);
      } else if (e.key === 'Escape' && fullscreen.active) {
        e.preventDefault();
        exitFullscreen().catch((err) => pushLog(`전체화면 해제 실패: ${err}`));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  onDestroy(disposeGame);
</script>

<main>
  {#if !fullscreen.active}<TopBar />{/if}
  <div class="body">
    <ActivityBar />
    <div class="center">
      <section class="view">
        <div class="view-body">
          {#if ui.view === 'main'}<MainPanel />{:else}<SettingsPanel />{/if}
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
  .view-body { flex: 1; min-height: 0; overflow: auto; }
</style>

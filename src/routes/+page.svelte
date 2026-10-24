<!-- 메인 창: 타이틀바; [메인 뷰 위 하단 패널]. 상태 표시줄은 없고 연결 상태는 설정 모달에서 본다. 설정은 가운데 모달로 띄운다.
     전체화면에서는 타이틀바를 숨기고 ESC 로 해제한다 (조합 상세·설정 모달이 열려 있으면 ESC 는 모달부터 닫는다). -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { ui, setBottomVisible, setSettingsOpen } from '$lib/stores/ui.svelte';
  import { initGame, disposeGame, pushLog } from '$lib/stores/game.svelte';
  import { initMemos } from '$lib/stores/memo.svelte';
  import { fullscreen, syncFullscreen, exitFullscreen } from '$lib/stores/fullscreen.svelte';
  import TopBar from '$lib/shell/TopBar.svelte';
  import BottomPanel from '$lib/shell/BottomPanel.svelte';
  import MainPanel from '$lib/panels/MainPanel.svelte';
  import SettingsDialog from '$lib/shell/SettingsDialog.svelte';
  import UnitDetail from '$lib/panels/UnitDetail.svelte';
  import NavDetail from '$lib/panels/NavDetail.svelte';
  import { detail, closeDetail, backDetail, forwardDetail } from '$lib/stores/detail.svelte';

  onMount(() => {
    void initGame();
    void initMemos();
    void syncFullscreen();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setBottomVisible(!ui.bottomVisible);
      } else if (e.key === 'Escape' && detail.current) {
        e.preventDefault();
        closeDetail();
      } else if (e.key === 'Escape' && ui.settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
      } else if (e.key === 'Escape' && fullscreen.active) {
        e.preventDefault();
        exitFullscreen().catch((err) => pushLog(`전체화면 해제 실패: ${err}`));
      }
    };
    // 마우스 옆 버튼: 3 = 뒤로, 4 = 앞으로. 조합 상세 모달의 히스토리를 움직인다 (닫힌 뒤에도 앞으로가기로 다시 열림)
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        if (detail.current) backDetail();
      } else if (e.button === 4) {
        e.preventDefault();
        forwardDetail();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  });
  onDestroy(disposeGame);
</script>

<main>
  {#if !fullscreen.active}<TopBar />{/if}
  <div class="body">
    <div class="center">
      <section class="view">
        <div class="view-body"><MainPanel /></div>
      </section>
      <BottomPanel />
    </div>
  </div>
  <SettingsDialog />
  <UnitDetail />
  <NavDetail />
</main>

<style>
  main { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .body { display: flex; flex: 1; min-height: 0; }
  .center { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
  .view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--c-bg-panel); }
  .view-body { flex: 1; min-height: 0; overflow: auto; }
</style>

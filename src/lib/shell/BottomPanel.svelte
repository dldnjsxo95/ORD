<!-- 접이식 하단 패널 (터미널 식): 상태 메시지 탭. 위쪽 가장자리로 크기 조절, Ctrl+J 또는 ∨ 로 접는다. -->
<script lang="ts">
  import { ui, setBottomVisible, setBottomHeight } from '$lib/stores/ui.svelte';
  import { game } from '$lib/stores/game.svelte';
  import TabButton from '$lib/ui/TabButton.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';

  const MIN = 80;
  let dragging = false;
  let startY = 0;
  let startH = 0;
  const maxHeight = () => Math.max(MIN, Math.round(window.innerHeight * 0.7));

  function down(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    startH = ui.bottomHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    ui.bottomHeight = Math.min(maxHeight(), Math.max(MIN, startH - (e.clientY - startY)));
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    setBottomHeight(ui.bottomHeight);
  }
</script>

{#if ui.bottomVisible}
  <section class="bottom" style:height={`${ui.bottomHeight}px`} aria-label="하단 패널">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="handle" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="하단 패널 크기 조절"
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}></div>
    <header class="tabs" role="tablist">
      <TabButton active>상태 메시지</TabButton>
      <span class="spacer"></span>
      <IconButton icon="trash" size="sm" label="메시지 지우기" onclick={() => (game.log = [])} />
      <IconButton icon="chevronDown" size="sm" label="하단 패널 숨기기" onclick={() => setBottomVisible(false)} />
    </header>
    <div class="body">
      {#if game.log.length === 0}
        <p class="empty">—</p>
      {:else}
        <pre class="mono">{game.log.join('\n')}</pre>
      {/if}
    </div>
  </section>
{/if}

<style>
  .bottom { position: relative; flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--c-bg-panel); border-top: 1px solid var(--c-border); }
  .handle { position: absolute; top: -3px; left: 0; right: 0; height: 6px; cursor: row-resize; z-index: 5; }
  .handle:hover, .handle:focus-visible { background: var(--c-accent-soft); }
  .tabs { display: flex; align-items: center; height: var(--tab-h); padding: 0 var(--sp-2); flex: none; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: var(--sp-2) var(--sp-5); }
  .body pre { margin: 0; font-size: var(--fs-2); white-space: pre-wrap; color: var(--c-text-2); user-select: text; }
  .empty { margin: 0; }
</style>

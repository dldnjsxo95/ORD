<!-- 설정 모달: 화면 가운데 패널로 SettingsPanel 을 띄운다. 배경 클릭·ESC·닫기 버튼으로 닫는다. -->
<script lang="ts">
  import { ui, setSettingsOpen } from '$lib/stores/ui.svelte';
  import SettingsPanel from '$lib/panels/SettingsPanel.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
</script>

{#if ui.settingsOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={() => setSettingsOpen(false)}>
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="dialog" role="dialog" aria-modal="true" aria-label="설정" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <header class="head">
        <span class="title">설정</span>
        <span class="spacer"></span>
        <IconButton icon="close" label="닫기 (ESC)" size="sm" onclick={() => setSettingsOpen(false)} />
      </header>
      <div class="body"><SettingsPanel /></div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 900; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c-bg-app) 60%, transparent); }
  .dialog {
    width: min(720px, calc(100vw - 48px)); max-height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden;
    background: var(--c-bg-panel); border: 1px solid var(--c-border-strong); border-radius: var(--r-3); box-shadow: var(--shadow-pop);
  }
  .head { display: flex; align-items: center; height: 32px; padding: 0 var(--sp-2) 0 var(--sp-5); background: var(--c-bg-app); border-bottom: 1px solid var(--c-border); flex: none; }
  .title { font-size: var(--fs-3); font-weight: 600; color: var(--c-accent-text); }
  .spacer { flex: 1; }
  .body { overflow: auto; min-height: 0; }
</style>

<!-- 프레임 없는 타이틀바 (35px), VS Code 식: 왼쪽 앱 이름, 오른쪽 도구 아이콘과 창 제어.
     바 자체가 드래그 영역이고 (data-tauri-drag-region) 버튼은 아니다. 감시는 앱이 켜지면 자동으로 시작되며
     폴더는 설정 뷰에서 바꾼다. -->
<script lang="ts">
  import { ui, setBottomVisible, setTheme } from '$lib/stores/ui.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import WindowControls from './WindowControls.svelte';
</script>

<header class="titlebar" data-tauri-drag-region>
  <span class="mark" data-tauri-drag-region><Icon name="layers" size={16} /></span>
  <span class="title" data-tauri-drag-region>ORD Helper <span class="v">2.323</span></span>
  <span class="spacer" data-tauri-drag-region></span>
  <div class="tools">
    <IconButton variant="titlebar" icon="panelBottom" active={ui.bottomVisible} label={ui.bottomVisible ? '하단 패널 숨기기' : '하단 패널 (Ctrl+J)'} onclick={() => setBottomVisible(!ui.bottomVisible)} />
    <IconButton variant="titlebar" icon={ui.theme === 'light' ? 'sun' : 'moon'} label={ui.theme === 'dark' ? '밝은 테마' : '어두운 테마'} onclick={() => setTheme(ui.theme === 'dark' ? 'light' : 'dark')} />
  </div>
  <WindowControls />
</header>

<style>
  .titlebar {
    position: relative; display: flex; align-items: center; height: var(--titlebar-h); padding-left: var(--sp-3); flex: none;
    background: var(--c-titlebar-bg); color: var(--c-titlebar-fg); border-bottom: 1px solid var(--c-border);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .mark { display: inline-flex; margin-right: var(--sp-2); color: var(--c-accent-text); }
  :root[data-window="inactive"] .mark { color: var(--c-titlebar-fg); }
  .title { font-size: var(--fs-2); color: var(--c-titlebar-fg); opacity: 0.85; white-space: nowrap; margin-right: var(--sp-3); }
  .v { color: var(--c-accent-text); }
  .tools { display: flex; align-items: center; gap: 2px; padding: 0 var(--sp-3); border-right: 1px solid var(--c-border); margin-right: var(--sp-1); height: 100%; }
</style>

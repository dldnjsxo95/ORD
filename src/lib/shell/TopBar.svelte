<!-- 프레임 없는 타이틀바 (35px), VS Code 식: 왼쪽 앱 이름, 오른쪽 감시 상태·폴더·시작/중지, 도구 아이콘, 창 제어.
     바 자체가 드래그 영역이고 (data-tauri-drag-region) 버튼은 아니다. -->
<script lang="ts">
  import { ui, setBottomVisible, setTheme } from '$lib/stores/ui.svelte';
  import { game, startWatch, stopWatch } from '$lib/stores/game.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import WindowControls from './WindowControls.svelte';

  const shortDir = $derived(game.dir.replace(/^.*[\\/](?=[^\\/]+[\\/][^\\/]+$)/, '…\\'));
</script>

<header class="titlebar" data-tauri-drag-region>
  <span class="mark" data-tauri-drag-region><Icon name="layers" size={16} /></span>
  <span class="title" data-tauri-drag-region>ORD Helper <span class="v">2.323</span></span>
  <span class="spacer" data-tauri-drag-region></span>

  <div class="link">
    <span class="dot" class:on={game.watching} title={game.watching ? '감시 중' : '중지됨'}></span>
    <input class="dir mono" type="text" bind:value={game.dir} disabled={game.watching} spellcheck="false" title={game.dir} placeholder="감시 폴더" />
    {#if game.watching}
      <Button size="sm" variant="ghost" onclick={() => void stopWatch()}>중지</Button>
    {:else}
      <Button size="sm" onclick={() => void startWatch()}>시작</Button>
    {/if}
  </div>

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
  .link { display: flex; align-items: center; gap: var(--sp-2); padding: 0 var(--sp-3); height: 100%; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-text-3); flex: none; }
  .dot.on { background: var(--c-ok-text); }
  .dir {
    width: 220px; height: 20px; box-sizing: border-box; padding: 0 var(--sp-2); font-size: var(--fs-2);
    color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1);
    text-overflow: ellipsis; direction: rtl; text-align: left;
  }
  .dir:focus { outline: 1px solid var(--c-focus); outline-offset: -1px; direction: ltr; }
  .dir:disabled { color: var(--c-text-2); }
  .tools { display: flex; align-items: center; gap: 2px; padding: 0 var(--sp-3); border-left: 1px solid var(--c-border); border-right: 1px solid var(--c-border); margin-right: var(--sp-1); height: 100%; }
</style>

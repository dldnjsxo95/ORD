<!-- 프레임 없는 창의 최소화 / 최대화·복원 / 닫기. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import WindowButton from '$lib/ui/WindowButton.svelte';

  const win = getCurrentWindow();
  let maximized = $state(false);

  onMount(() => {
    let un: (() => void) | undefined;
    const refresh = () => win.isMaximized().then((m) => (maximized = m)).catch(() => {});
    refresh();
    win.onResized(refresh).then((u) => (un = u)).catch(() => {});
    return () => un?.();
  });
</script>

<div class="controls">
  <WindowButton kind="minimize" label="최소화" onclick={() => void win.minimize()} />
  <WindowButton kind={maximized ? 'restore' : 'maximize'} label={maximized ? '이전 크기로' : '최대화'} onclick={() => void win.toggleMaximize()} />
  <WindowButton kind="close" label="닫기" onclick={() => void win.close()} />
</div>

<style>
  .controls { display: flex; height: 100%; flex: none; }
</style>

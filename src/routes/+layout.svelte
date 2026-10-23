<!-- 루트 레이아웃: 디자인 토큰, 테마, 창 포커스 상태를 페이지보다 먼저 세팅한다. -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import '$lib/theme/tokens.css';
  import { ui } from '$lib/stores/ui.svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    document.documentElement.dataset.theme = ui.theme;
  });

  onMount(() => {
    const win = getCurrentWindow();
    let un: (() => void) | undefined;
    const set = (focused: boolean) => (document.documentElement.dataset.window = focused ? 'active' : 'inactive');
    win.isFocused().then(set).catch(() => {});
    win.onFocusChanged(({ payload }) => set(payload)).then((u) => (un = u)).catch(() => {});
    return () => un?.();
  });
</script>

{@render children()}

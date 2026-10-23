<!-- 타이틀바 창 제어 버튼 (최소화 / 최대화 / 복원 / 닫기). Windows 캡션 버튼처럼 46×35. -->
<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props { kind: 'minimize' | 'maximize' | 'restore' | 'close'; label: string; onclick: () => void }
  let { kind, label, onclick }: Props = $props();
  const icon = $derived(kind === 'minimize' ? 'windowMin' : kind === 'maximize' ? 'windowMax' : kind === 'restore' ? 'windowRestore' : 'windowClose');
</script>

<button type="button" class="ui-winbtn {kind}" aria-label={label} title={label} {onclick}>
  <Icon name={icon} size={kind === 'minimize' ? 14 : 12} />
</button>

<style>
  .ui-winbtn {
    width: 46px; height: 100%; border: 0; background: transparent; color: var(--c-titlebar-fg); cursor: default;
    display: inline-flex; align-items: center; justify-content: center; transition: background-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }
  .ui-winbtn:hover { background: var(--c-bg-raised); color: var(--c-text); }
  .ui-winbtn.close:hover { background: var(--c-danger); color: var(--c-on-accent); }
  .ui-winbtn:focus-visible { outline: 1px solid var(--c-focus); outline-offset: -1px; }
</style>

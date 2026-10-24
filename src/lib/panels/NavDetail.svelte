<!-- 항법 상세 모달: 항법 행을 클릭하면 열린다 (detail 스토어의 current 가 nav_ 로 시작할 때). 효과 설명 + 메모. ESC/배경 클릭으로 닫힘. -->
<script lang="ts">
  import { detail, closeDetail } from '$lib/stores/detail.svelte';
  import { memo, memoOf, setMemo, flushMemos } from '$lib/stores/memo.svelte';
  import { NAV_BY_ID } from '$lib/layout';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';

  const id = $derived(detail.current);
  const entry = $derived(id ? NAV_BY_ID.get(id) : undefined);
  const memoText = $derived(id ? memoOf(id) : '');
</script>

{#if id && entry}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={closeDetail}>
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-modal="true" aria-label="항법 상세" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <header class="bar">
        <UnitIcon {id} name={entry.label ?? ''} size={20} />
        <span class="nm">{entry.label}</span>
        {#if entry.tier}<span class="tier">({entry.tier})</span>{/if}
        {#if entry.group}<span class="gr">[항법 :: {entry.group}]</span>{/if}
        <span class="spacer"></span>
        <IconButton icon="close" label="닫기 (ESC)" size="sm" onclick={closeDetail} />
      </header>
      <div class="body">
        <h3>효과</h3>
        <ul class="desc">
          {#each entry.desc ?? [] as d, i (i)}<li class:warn={d.startsWith('페널티')} class:muted={d.startsWith('항법 기본효과')}>{d}</li>{/each}
        </ul>
        <h3>메모 <span class="hint">{memo.error ? `저장 실패: ${memo.error}` : '호버 카드에 표시. 앱을 다시 설치해도 유지'}</span></h3>
        <textarea rows="4" placeholder="이 항법에 대한 메모 (언제 고를지, 조합과의 궁합 등)" value={memoText} oninput={(e) => setMemo(id, (e.currentTarget as HTMLTextAreaElement).value)} onblur={() => void flushMemos()}></textarea>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 950; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c-bg-app) 70%, transparent); }
  .modal { width: 420px; max-width: 90vw; display: flex; flex-direction: column; overflow: hidden; background: var(--c-bg-panel); border: 1px solid var(--c-border-strong); border-radius: var(--r-3); box-shadow: var(--shadow-pop); font-size: 11px; }
  .bar { display: flex; align-items: center; gap: var(--sp-2); height: 32px; padding: 0 var(--sp-2) 0 var(--sp-3); background: var(--c-bg-app); border-bottom: 1px solid var(--c-border); flex: none; }
  .bar .nm { font-size: 14px; font-weight: 700; color: var(--c-text); }
  .bar .tier { font-weight: 700; color: var(--c-warn-text); }
  .bar .gr { color: var(--c-accent-text); font-weight: 600; }
  .spacer { flex: 1; }
  .body { padding: var(--sp-3) var(--sp-4) var(--sp-4); }
  h3 { margin: var(--sp-2) 0; font-size: 11px; font-weight: 600; color: var(--c-accent-text); }
  h3 .hint { font-weight: 400; color: var(--c-text-3); }
  .desc { margin: 0 0 var(--sp-3); padding-left: 16px; line-height: 1.5; color: var(--c-text); }
  .desc .warn { color: var(--c-warn-text); }
  .desc .muted { color: var(--c-text-3); }
  textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 56px; padding: var(--sp-2) var(--sp-3); font: inherit; line-height: 1.5; color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-2); }
  textarea:focus { outline: 1px solid var(--c-focus); outline-offset: -1px; }
</style>

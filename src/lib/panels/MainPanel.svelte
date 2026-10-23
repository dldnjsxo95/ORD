<!-- 메인 뷰 (사용자 사양 2026-10-23): 상단 툴바 → 능력치 필터 → 8열 패널 (data/layout.json).
     수량은 실시간 보유량 + 수동 조정(+/−). 수동 조정이 있으면 백엔드 simulate 로 조합을 다시 계산한다. -->
<script lang="ts">
  import { game, unit as unitOf } from '$lib/stores/game.svelte';
  import { fullscreen, toggleFullscreen } from '$lib/stores/fullscreen.svelte';
  import { plan, effectiveCount, rawCount, adjust, setAll, resetAll, clearManual, hasManual, adjustItem, setSort, toggleFilter, clearFilters, setFilterOpen, combos, onLiveUpdate, type SortMode } from '$lib/stores/plan.svelte';
  import { COLUMNS, FILTERS, type Entry } from '$lib/layout';
  import { traitsOf } from '$lib/traits';
  import type { Unit } from '$lib/api';
  import CategoryPanel from './CategoryPanel.svelte';
  import UnitRow from './UnitRow.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import HoverCard from '$lib/ui/HoverCard.svelte';

  const comboByResult = $derived(new Map(combos().map((c) => [c.result, c])));
  const filterSet = $derived(new Set(plan.filters));
  // 필터·능력치는 괄호 요약(traits.ts)만 본다. 추출 태그(u.tags)는 쓰지 않는다.
  const matches = (u: Unit) => filterSet.size === 0 || plan.filters.every((f) => traitsOf(u.id).includes(f));

  // 실시간 갱신 시 수동 조정이 있으면 재계산
  $effect(() => {
    void game.payload;
    onLiveUpdate();
  });

  /** 변형 유닛(baseForm 있음)은 그 코드의 원본 수량, 기본 유닛은 변형 합산 수량 */
  function countOf(u: Unit): number {
    return u.baseForm ? rawCount(u.id) : effectiveCount(u.id);
  }

  interface Row { entry: Entry; unit?: Unit }
  function rows(entries: Entry[] | undefined): Row[] {
    const list: Row[] = (entries ?? []).map((entry) => ({ entry, unit: entry.id ? unitOf(entry.id) : undefined }));
    if (plan.sort === 'name') return [...list].sort((a, b) => (a.entry.label ?? a.unit?.name ?? a.entry.text ?? '').localeCompare(b.entry.label ?? b.unit?.name ?? b.entry.text ?? '', 'ko'));
    if (plan.sort === 'count') return [...list].sort((a, b) => (b.unit ? countOf(b.unit) : -1) - (a.unit ? countOf(a.unit) : -1));
    return list;
  }
  const unitIds = (entries: Entry[] | undefined) => (entries ?? []).filter((e) => e.id && unitOf(e.id)).map((e) => e.id!);
  const allOn = (entries: Entry[] | undefined) => { const ids = unitIds(entries); return ids.length > 0 && ids.every((id) => effectiveCount(id) > 0); };

  /** 현재 능력치: 보유 유닛(수량 반영)의 괄호 요약 라벨 집계 */
  const statRows = $derived.by(() => {
    const acc = new Map<string, number>();
    for (const u of game.db?.units ?? []) {
      const n = effectiveCount(u.id);
      if (!n) continue;
      for (const t of traitsOf(u.id)) acc.set(t, (acc.get(t) ?? 0) + n);
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  });

  const readyCount = $derived(combos().filter((c) => c.craftable).length);

  // 전체화면 (ESC 로 해제, 상단 바 숨김: +page.svelte)
  function onFullscreen() {
    toggleFullscreen().catch((e) => (game.error = String(e)));
  }

  let noticeOpen = $state(false);
</script>

<div class="main">
  <!-- 1. 상단 툴바 -->
  <div class="toolbar">
    <span class="left">
      {#if hasManual()}<Button size="sm" variant="ghost" onclick={clearManual}>실시간 값으로 복귀</Button>{/if}
      {#if readyCount}<span class="ready-badge">조합 가능 {readyCount}</span>{/if}
    </span>
    <span class="spacer"></span>
    <button type="button" class="link" onclick={() => (noticeOpen = !noticeOpen)}><Icon name="info" size={12} /> 주의사항</button>
    <Button size="sm" onclick={() => setSort('count')}>추천 조합</Button>
    <button type="button" class="link" onclick={resetAll}>전체 초기화</button>
    <Button size="sm" variant="ghost" icon={fullscreen.active ? 'fullscreenExit' : 'fullscreen'} onclick={onFullscreen} title={fullscreen.active ? 'ESC 로도 해제됩니다' : undefined}>{fullscreen.active ? '전체화면 해제 (ESC)' : '전체화면'}</Button>
    <select class="sort" value={plan.sort} onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortMode)}>
      <option value="default">기본순</option>
      <option value="name">이름순</option>
      <option value="count">수량순</option>
    </select>
  </div>
  {#if noticeOpen}
    <div class="notice">
      괄호 요약은 사양서의 표기이고, 능력치 필터 태그는 스킬 설명 문구에서 자동 추정한 값입니다. 수량은 게임에서 읽은 값에 +/− 조정을 더한 것이며,
      조정 중에는 조합이 그 값으로 다시 계산됩니다. 변형 유닛(쵸파 폭주, 상디 제르마 등)은 해당 코드의 원본 수량을 따로 보여 줍니다.
    </div>
  {/if}

  <!-- 2. 능력치 필터 -->
  <button type="button" class="filter-bar" onclick={() => setFilterOpen(!plan.filterOpen)}>
    능력치 필터 {#if plan.filters.length}<span class="n">{plan.filters.length}</span>{/if}
    <Icon name={plan.filterOpen ? 'chevronDown' : 'chevronRight'} size={12} />
  </button>
  {#if plan.filterOpen}
    <div class="filters">
      {#each FILTERS as f (f)}
        <label class="f" class:on={filterSet.has(f)}>
          <input type="checkbox" checked={filterSet.has(f)} onchange={() => toggleFilter(f)} />
          <span>{f}</span>
        </label>
      {/each}
      {#if plan.filters.length}<button type="button" class="link clear" onclick={clearFilters}>필터 해제</button>{/if}
    </div>
  {/if}

  <!-- 3. 8열 패널 -->
  <div class="columns">
    {#each COLUMNS as col, ci (ci)}
      <div class="col">
        {#each col as p (p.id)}
          {#if p.kind === 'units'}
            <CategoryPanel id={p.id} title={p.title} count={unitIds(p.entries).length} allOn={allOn(p.entries)} onall={(on) => setAll(unitIds(p.entries), on)}>
              {#each rows(p.entries) as r, i (`${p.id}-${i}-${r.entry.id ?? 't'}`)}
                {#if r.unit}
                  <UnitRow unit={r.unit} label={r.entry.label} note={r.entry.note} badges={r.entry.badges} tier={r.entry.tier} count={countOf(r.unit)} combo={comboByResult.get(r.unit.id)} dimmed={!matches(r.unit)} onadjust={(d) => adjust(r.unit!.id, d)} />
                {:else}
                  <div class="row-text" class:unresolved={r.entry.unresolved || (r.entry.id && !r.unit)} title={r.entry.unresolved ? '데이터에서 찾지 못한 항목' : undefined}>
                    <span class="t">{r.entry.text ?? r.entry.label ?? r.entry.id}</span>
                    {#each r.entry.badges ?? [] as b, bi (bi)}<span class="tb {b}"><Icon name={b === 'flag' ? 'flag' : b === 'sword' ? 'sword' : b === 'plus' ? 'plusCircle' : 'heart'} size={10} /></span>{/each}
                    {#if r.entry.unresolved}<span class="q">?</span>{/if}
                  </div>
                {/if}
              {/each}
            </CategoryPanel>
          {:else if p.kind === 'stats'}
            <CategoryPanel id={p.id} title={p.title} count={statRows.length}>
              {#each statRows as [tag, n] (tag)}
                <div class="kv"><span class="k">{tag}</span><span class="v">{n}</span></div>
              {/each}
              {#if statRows.length === 0}<div class="empty">보유 유닛 없음</div>{/if}
            </CategoryPanel>
          {:else if p.kind === 'resources'}
            <CategoryPanel id={p.id} title={p.title}>
              <div class="kv"><span class="k">골드</span><span class="v mono">{(game.payload?.state.gold ?? 0).toLocaleString()}</span></div>
              <div class="kv"><span class="k">목재</span><span class="v mono">{game.payload?.state.wood ?? '-'}</span></div>
              <div class="kv">
                <span class="k">특성 포인트</span>
                <span class="ctl">
                  <button type="button" onclick={() => (plan.skillPoints += 1)}>+</button>
                  <button type="button" onclick={() => (plan.skillPoints = Math.max(0, plan.skillPoints - 1))} disabled={plan.skillPoints === 0}>−</button>
                  <span class="v mono">{plan.skillPoints}</span>
                </span>
              </div>
            </CategoryPanel>
          {:else}
            <CategoryPanel id={p.id} title={p.title} count={(p.entries ?? []).length}>
              {#each p.entries ?? [] as e (e.id)}
                <div class="kv">
                  <span class="k">{e.label}{#if e.note} <span class="note">({e.note})</span>{/if}</span>
                  <span class="ctl">
                    <button type="button" onclick={() => adjustItem(e.id!, 1)}>+</button>
                    <button type="button" onclick={() => adjustItem(e.id!, -1)} disabled={!(plan.items[e.id!] ?? 0)}>−</button>
                    <span class="v mono" class:zero={!(plan.items[e.id!] ?? 0)}>{plan.items[e.id!] ?? 0}</span>
                  </span>
                </div>
              {/each}
            </CategoryPanel>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
  <HoverCard />
</div>

<style>
  .main { display: flex; flex-direction: column; height: 100%; font-size: 11px; }
  .toolbar { display: flex; align-items: center; gap: var(--sp-2); height: 28px; padding: 0 var(--sp-3); flex: none; border-bottom: 1px solid var(--c-border); background: var(--c-bg-app); }
  .toolbar .left { display: inline-flex; gap: var(--sp-2); align-items: center; }
  .ready-badge { color: var(--c-ok-text); font-weight: 600; }
  .link { border: 0; background: none; color: var(--c-text-2); font: inherit; font-size: 11px; cursor: pointer; padding: 2px 4px; display: inline-flex; align-items: center; gap: 2px; }
  .link:hover { color: var(--c-text); }
  .sort { height: 20px; font-size: 11px; color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1); }
  .notice { padding: var(--sp-2) var(--sp-4); color: var(--c-text-2); background: var(--c-bg-panel); border-bottom: 1px solid var(--c-border); line-height: 1.5; }
  .filter-bar { height: 20px; border: 0; border-bottom: 1px solid var(--c-border); background: var(--c-bg-panel); color: var(--c-text-2); font: inherit; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; flex: none; }
  .filter-bar:hover { color: var(--c-text); }
  .filter-bar .n { color: var(--c-accent-text); font-weight: 600; }
  /* 넓은 창에서 19열 × 2행, 좁으면 열 수가 줄어든다 */
  .filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 1px 4px; padding: 3px var(--sp-3); border-bottom: 1px solid var(--c-border); background: var(--c-bg-panel); flex: none; }
  .f { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .f.on { color: var(--c-accent-text); }
  .f input { width: 11px; height: 11px; margin: 0; accent-color: var(--c-accent); flex: none; }
  .f span { overflow: hidden; text-overflow: ellipsis; }
  .clear { grid-column: span 2; justify-self: end; }
  .columns { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 3px; padding: 3px; flex: 1; min-height: 0; overflow: auto; align-content: start; }
  .col { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .empty { padding: 2px 6px; color: var(--c-text-3); }
  .row-text { display: flex; align-items: center; gap: 4px; height: 20px; padding: 0 4px; color: var(--c-text-2); border-bottom: 1px solid var(--c-border-row); white-space: nowrap; overflow: hidden; }
  .row-text .t { overflow: hidden; text-overflow: ellipsis; }
  .row-text.unresolved { color: var(--c-text-3); }
  .row-text .q { color: var(--c-warn-text); font-weight: 700; }
  .row-text .tb { display: inline-flex; color: var(--c-text-2); } .row-text .tb.flag { color: var(--c-danger); }
  .kv { display: flex; align-items: center; justify-content: space-between; gap: 4px; height: 20px; padding: 0 4px; border-bottom: 1px solid var(--c-border-row); }
  .kv .k { color: var(--c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kv .note { color: var(--c-text-3); font-size: 10px; }
  .kv .v { color: var(--c-text); font-variant-numeric: tabular-nums; }
  .kv .v.zero { color: var(--c-text-3); }
  .ctl { display: inline-flex; align-items: center; gap: 1px; flex: none; }
  .ctl button { width: 16px; height: 16px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 11px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .ctl .v { min-width: 16px; text-align: right; }
</style>

<!-- 메인 뷰 (사용자 사양 2026-10-23): 상단 툴바 → 능력치 필터 → 8열 매소너리 패널.
     수량은 실시간 보유량 + 수동 조정(+/−). 수동 조정이 있으면 백엔드 simulate 로 조합을 다시 계산한다. -->
<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { game } from '$lib/stores/game.svelte';
  import { plan, effectiveCount, adjust, setAll, resetAll, clearManual, hasManual, adjustItem, setSort, toggleFilter, clearFilters, setFilterOpen, combos, onLiveUpdate, type SortMode } from '$lib/stores/plan.svelte';
  import { COLUMNS, FILTERS, placeUnits, type PanelDef, type Placed } from '$lib/layout';
  import type { ComboStatus, Unit } from '$lib/api';
  import CategoryPanel from './CategoryPanel.svelte';
  import UnitRow from './UnitRow.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  const placed = $derived(placeUnits(game.db?.units ?? []));
  const comboByResult = $derived(new Map(combos().map((c) => [c.result, c])));
  const filterSet = $derived(new Set(plan.filters));
  const matches = (u: Unit) => filterSet.size === 0 || plan.filters.every((f) => u.tags?.includes(f));

  // 실시간 갱신 시 수동 조정이 있으면 재계산
  $effect(() => {
    void game.payload;
    onLiveUpdate();
  });

  function sorted(list: Placed[]): Placed[] {
    if (plan.sort === 'name') return [...list].sort((a, b) => a.unit.name.localeCompare(b.unit.name, 'ko'));
    if (plan.sort === 'count') return [...list].sort((a, b) => effectiveCount(b.unit.id) - effectiveCount(a.unit.id) || a.unit.name.localeCompare(b.unit.name, 'ko'));
    return list;
  }
  const allOn = (list: Placed[]) => list.length > 0 && list.every((p) => effectiveCount(p.unit.id) > 0);

  /** 현재 능력치: 보유 유닛(수량 반영)의 태그 집계 */
  const statRows = $derived.by(() => {
    const acc = new Map<string, number>();
    for (const u of game.db?.units ?? []) {
      const n = effectiveCount(u.id);
      if (!n) continue;
      for (const t of u.tags ?? []) acc.set(t, (acc.get(t) ?? 0) + n);
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  });

  /** 아이템: 조합식이 요구하는 기록지침 아이템 목록 */
  const items = $derived.by(() => {
    const m = new Map<string, string>();
    for (const r of game.db?.recipes ?? []) for (const i of r.items) m.set(i.id, i.name);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  const readyCount = $derived(combos().filter((c) => c.craftable).length);

  // 전체화면
  const win = getCurrentWindow();
  let fullscreen = $state(false);
  onMount(() => { win.isFullscreen().then((f) => (fullscreen = f)).catch(() => {}); });
  async function toggleFullscreen() {
    try { await win.setFullscreen(!fullscreen); fullscreen = !fullscreen; } catch (e) { game.error = String(e); }
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
    <Button size="sm" variant="ghost" icon={fullscreen ? 'fullscreenExit' : 'fullscreen'} onclick={toggleFullscreen}>{fullscreen ? '전체화면 해제' : '전체화면'}</Button>
    <select class="sort" value={plan.sort} onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortMode)}>
      <option value="default">기본순</option>
      <option value="name">이름순</option>
      <option value="count">수량순</option>
    </select>
  </div>
  {#if noticeOpen}
    <div class="notice">
      물딜/마딜/스턴 분류와 능력치 태그는 스킬 설명 문구로 자동 추정한 값입니다. "?" 표시는 물딜/마딜 판정이 없어 임시로 마딜에 둔 유닛이며,
      data/overrides.json 으로 바로잡을 수 있습니다. 수량은 게임에서 읽은 값에 +/− 조정을 더한 것이고, 조정 중에는 조합이 그 값으로 다시 계산됩니다.
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
            {@const list = sorted(placed.get(p.id) ?? [])}
            <CategoryPanel id={p.id} title={p.title} count={list.length} allOn={allOn(list)} onall={(on) => setAll(list.map((x) => x.unit.id), on)}>
              {#each list as x (x.unit.id)}
                <UnitRow unit={x.unit} count={effectiveCount(x.unit.id)} combo={comboByResult.get(x.unit.id)} dimmed={!matches(x.unit)} uncertain={x.uncertain} onadjust={(d) => adjust(x.unit.id, d)} />
              {/each}
              {#if list.length === 0}<div class="empty">—</div>{/if}
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
            <CategoryPanel id={p.id} title={p.title} count={items.length}>
              {#each items as [id, name] (id)}
                <div class="kv">
                  <span class="k">{name}</span>
                  <span class="ctl">
                    <button type="button" onclick={() => adjustItem(id, 1)}>+</button>
                    <button type="button" onclick={() => adjustItem(id, -1)} disabled={!(plan.items[id] ?? 0)}>−</button>
                    <span class="v mono" class:zero={!(plan.items[id] ?? 0)}>{plan.items[id] ?? 0}</span>
                  </span>
                </div>
              {/each}
            </CategoryPanel>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
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
  .kv { display: flex; align-items: center; justify-content: space-between; gap: 4px; height: 20px; padding: 0 4px; border-bottom: 1px solid var(--c-border-row); }
  .kv .k { color: var(--c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kv .v { color: var(--c-text); font-variant-numeric: tabular-nums; }
  .kv .v.zero { color: var(--c-text-3); }
  .ctl { display: inline-flex; align-items: center; gap: 1px; }
  .ctl button { width: 16px; height: 16px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 11px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .ctl .v { min-width: 16px; text-align: right; }
</style>

<!-- 메인 뷰 (사용자 사양 2026-10-23): 상단 툴바 → 능력치 필터 → 8열 패널 (data/layout.json).
     수량은 실시간 보유량 + 수동 조정(+/−). 수동 조정이 있으면 백엔드 simulate 로 조합을 다시 계산한다. -->
<script lang="ts">
  import { game, unit as unitOf } from '$lib/stores/game.svelte';
  import { fullscreen, toggleFullscreen } from '$lib/stores/fullscreen.svelte';
  import { plan, effectiveCount, effectiveCounts, rawCount, adjust, resetAll, clearManual, hasManual, setRound, toggleAssumed, clearAssumed, setSort, toggleFilter, clearFilters, setFilterOpen, combos, onLiveUpdate, type SortMode } from '$lib/stores/plan.svelte';
  import { COLUMNS, ALL_PANELS, ENTRY_BY_ID, FILTERS, type Entry } from '$lib/layout';
  import { traitsOf, statsOfNote } from '$lib/traits';
  import { openDetail } from '$lib/stores/detail.svelte';
  import { allocate, usedByGrade, compareUsage, type Holdings } from '$lib/combo-tree';
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

  /** 변형 유닛(baseForm 있음)은 그 코드의 원본 수량, 기본 유닛은 가정 배정 후 남은 수량 */
  function countOf(u: Unit): number {
    return u.baseForm ? rawCount(u.id) : (ctxFor(u.id).counts.get(u.id) ?? 0);
  }

  interface Row { entry: Entry; unit?: Unit }
  function rows(entries: Entry[] | undefined): Row[] {
    const list: Row[] = (entries ?? []).map((entry) => ({ entry, unit: entry.id ? unitOf(entry.id) : undefined }));
    if (plan.sort === 'name') return [...list].sort((a, b) => (a.entry.label ?? a.unit?.name ?? a.entry.text ?? '').localeCompare(b.entry.label ?? b.unit?.name ?? b.entry.text ?? '', 'ko'));
    if (plan.sort === 'count') return [...list].sort((a, b) => (b.unit ? countOf(b.unit) : -1) - (a.unit ? countOf(a.unit) : -1));
    if (plan.sort === 'usage' && game.db) {
      // 패 활용순: 보유 패를 높은 등급부터 많이 쓰는 조합이 위 (흔함은 최대한 아낀다). 같으면 사양서 순.
      const db = game.db;
      const key = new Map<Row, number[]>();
      for (const r of list) {
        if (!r.unit) continue;
        const c = ctxFor(r.unit.id);
        key.set(r, usedByGrade(db, r.unit.id, (u) => c.counts.get(u) ?? 0, c.evolution, c.wisps));
      }
      return [...list].sort((a, b) => (key.has(a) && key.has(b) ? compareUsage(key.get(a)!, key.get(b)!) : key.has(b) ? 1 : key.has(a) ? -1 : 0));
    }
    return list;
  }
  const unitIds = (entries: Entry[] | undefined) => (entries ?? []).filter((e) => e.id && unitOf(e.id)).map((e) => e.id!);

  /** 기록지침(아이템) 보유 여부: 게임에서 읽은 값 (플레이어 어빌리티 또는 인벤토리) */
  const itemCount = (id: string) => game.payload?.state.items?.[id] ?? 0;

  /** 오로성 효과가 적용되는 라운드 */
  const GOROSEI_ROUND = 50;
  /**
   * 현재 능력치: 보유 유닛(수량 반영)과 보유 아이템의 괄호 요약을 라벨별로 합산한다.
   * 숫자가 붙은 토큰은 부호 포함 합산(이감40 + 이감-15 = 25, 깍20 + 깍-15 = 5, 0.5스턴 + 1스턴 = 1.5), 숫자가 없는 토큰(암브 등)은 보유 개수.
   * 오로성은 50라운드부터만 넣는다 (현재 라운드는 자원 패널에서 수동 입력).
   */
  const statRows = $derived.by(() => {
    const acc = new Map<string, { sum: number; count: number; numeric: boolean }>();
    const add = (note: string | undefined, n: number) => {
      for (const s of statsOfNote(note)) {
        const cur = acc.get(s.label) ?? { sum: 0, count: 0, numeric: false };
        cur.count += n;
        if (s.value != null) { cur.sum += s.value * n; cur.numeric = true; }
        acc.set(s.label, cur);
      }
    };
    for (const u of game.db?.units ?? []) {
      const n = effectiveCount(u.id);
      if (!n) continue;
      if (u.grade === '오로성' && plan.round < GOROSEI_ROUND) continue;
      add(ENTRY_BY_ID.get(u.id)?.note, n);
    }
    for (const p of ALL_PANELS) {
      if (p.kind !== 'items') continue;
      for (const e of p.entries ?? []) {
        const n = e.id ? itemCount(e.id) : 0;
        if (n) add(e.note, n);
      }
    }
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));
    return [...acc.entries()]
      .map(([label, v]) => ({ label, text: v.numeric ? fmt(v.sum) : String(v.count), negative: v.numeric && v.sum < 0, order: v.numeric ? Math.abs(v.sum) : v.count }))
      .sort((a, b) => b.order - a.order);
  });

  /** 모든 유닛의 유효 수량 표. 갱신당 한 번만 만들어 모든 행의 게이지 계산이 공유한다 */
  const countMap = $derived(effectiveCounts());
  /**
   * 가정 배정: 우클릭으로 가정한 유닛들에 보유 패(위습·진화체 포함)를 순서대로 배정한 뒤 남은 상태.
   * 가정하지 않은 행은 남은 패로, 가정한 행은 자기 배정 직전의 패로 수량·게이지·정렬을 계산한다.
   */
  const view = $derived.by(() => {
    const live: Holdings = { counts: countMap, wisps: countMap.get('e018') ?? 0, evolution: game.payload?.state.evolution ?? null };
    if (!game.db || plan.assumed.length === 0) return { ...live, before: new Map<string, Holdings>() };
    return allocate(game.db, plan.assumed, countMap, live.evolution, live.wisps);
  });
  const ctxFor = (id: string): Holdings => view.before.get(id) ?? view;
  const assumedName = (id: string) => ENTRY_BY_ID.get(id)?.label ?? unitOf(id)?.name ?? id;

  const readyCount = $derived(combos().filter((c) => c.craftable).length);
  /** 게임과 연동 중(실시간 state 수신): 수량은 게임 값이므로 +/− 버튼을 숨긴다 */
  const live = $derived(game.watching && game.payload != null);

  // 전체화면 (ESC 로 해제, 상단 바 숨김: +page.svelte)
  function onFullscreen() {
    toggleFullscreen().catch((e) => (game.error = String(e)));
  }

</script>

<div class="main">
  <!-- 1. 상단 툴바 -->
  <div class="toolbar">
    <span class="left">
      {#if hasManual()}<Button size="sm" variant="ghost" onclick={clearManual}>실시간 값으로 복귀</Button>{/if}
      {#if readyCount}<span class="ready-badge">조합 가능 {readyCount}</span>{/if}
      {#if plan.assumed.length}
        <span class="assumed">가정:
          {#each plan.assumed as id (id)}<button type="button" class="chip" title="우클릭한 유닛. 누르면 해제" onclick={() => toggleAssumed(id)}>{assumedName(id)} ✕</button>{/each}
          <button type="button" class="link" onclick={clearAssumed}>모두 해제</button>
        </span>
      {/if}
    </span>
    <span class="spacer"></span>
    <Button size="sm" onclick={() => setSort('count')}>추천 조합</Button>
    <button type="button" class="link" onclick={resetAll}>전체 초기화</button>
    <Button size="sm" variant="ghost" icon={fullscreen.active ? 'fullscreenExit' : 'fullscreen'} onclick={onFullscreen} title={fullscreen.active ? 'ESC 로도 해제됩니다' : undefined}>{fullscreen.active ? '전체화면 해제 (ESC)' : '전체화면'}</Button>
    <select class="sort" value={plan.sort} onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortMode)}>
      <option value="default">기본순</option>
      <option value="name">이름순</option>
      <option value="count">수량순</option>
      <option value="usage">패 활용순</option>
    </select>
  </div>

  <!-- 2. 능력치 필터 -->
  <button type="button" class="filter-bar" onclick={() => setFilterOpen(!plan.filterOpen)}>
    능력치 필터 {#if plan.filters.length}<span class="n">{plan.filters.length}</span>{/if}
    <Icon name={plan.filterOpen ? 'chevronDown' : 'chevronRight'} size={12} />
  </button>
  {#if plan.filterOpen}
    <div class="filters">
      {#each FILTERS as f (f)}
        <label class="f" class:on={filterSet.has(f)} title={f}>
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
            <CategoryPanel id={p.id} title={p.title} count={unitIds(p.entries).length}>
              {#each rows(p.entries) as r, i (`${p.id}-${i}-${r.entry.id ?? 't'}`)}
                {#if r.unit}
                  <UnitRow unit={r.unit} label={r.entry.label} note={r.entry.note} badges={r.entry.badges} tier={r.entry.tier} count={countOf(r.unit)} combo={comboByResult.get(r.unit.id)} dimmed={!matches(r.unit)} adjustable={!live} counts={ctxFor(r.unit.id).counts} wisps={ctxFor(r.unit.id).wisps} evolution={ctxFor(r.unit.id).evolution} assumed={plan.assumed.includes(r.unit.id)} onassume={() => toggleAssumed(r.unit!.id)} onadjust={(d) => adjust(r.unit!.id, d)} onopen={() => openDetail(r.unit!.id)} />
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
              <!-- 현재 라운드: 게임에서 못 읽으므로 수동. 오로성 효과는 50라운드부터 합산 -->
              <div class="kv">
                <span class="k">현재 라운드 <span class="note">(오로성 {GOROSEI_ROUND}라~)</span></span>
                <span class="ctl">
                  <button type="button" onclick={() => setRound(plan.round + 1)}>+</button>
                  <button type="button" onclick={() => setRound(plan.round - 1)} disabled={plan.round === 0}>−</button>
                  <span class="v mono">{plan.round}</span>
                </span>
              </div>
              {#each statRows as s (s.label)}
                <div class="kv" title={s.label}><span class="k">{s.label}</span><span class="v mono" class:neg={s.negative}>{s.text}</span></div>
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
                {@const n = e.id ? itemCount(e.id) : 0}
                <div class="kv">
                  <span class="k">{e.label}{#if e.note} <span class="note">({e.note})</span>{/if}</span>
                  <span class="cnt" class:zero={n === 0}>{n}</span>
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
  .assumed { display: inline-flex; align-items: center; gap: 3px; color: var(--c-text-2); }
  .chip { border: 1px solid var(--c-accent); border-radius: var(--r-2); background: var(--c-accent-soft); color: var(--c-text); font: inherit; font-size: 10px; padding: 0 5px; cursor: pointer; }
  .chip:hover { background: var(--c-danger); color: var(--c-on-accent); border-color: var(--c-danger); }
  .link { border: 0; background: none; color: var(--c-text-2); font: inherit; font-size: 11px; cursor: pointer; padding: 2px 4px; display: inline-flex; align-items: center; gap: 2px; }
  .link:hover { color: var(--c-text); }
  .sort { height: 20px; font-size: 11px; color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1); }
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
  .kv .v.neg { color: var(--c-danger-text); }
  .kv .cnt { min-width: 16px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--c-accent-text); }
  .kv .cnt.zero { color: var(--c-text-3); font-weight: 400; }
  .ctl { display: inline-flex; align-items: center; gap: 1px; flex: none; }
  .ctl button { width: 16px; height: 16px; padding: 0; border: 1px solid var(--c-border-strong); border-radius: 2px; background: var(--c-bg-input); color: var(--c-text-2); font-size: 11px; line-height: 1; cursor: pointer; }
  .ctl button:hover:not(:disabled) { background: var(--c-bg-raised); color: var(--c-text); }
  .ctl button:disabled { opacity: 0.35; cursor: default; }
  .ctl .v { min-width: 16px; text-align: right; }
</style>

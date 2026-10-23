<!-- 메인 뷰: 전체 유닛을 분류 격자로, 스크롤 없이 화면에 맞춰 축소해서 보여준다.
     보유 유닛은 수량 배지, 지금 조합 가능한 결과 유닛은 초록 테두리, 재료가 일부 모인 유닛은 아래 진행 바. -->
<script lang="ts">
  import { game } from '$lib/stores/game.svelte';
  import { CATEGORIES, categorize } from '$lib/categories';
  import type { Unit } from '$lib/api';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';

  const groups = $derived(categorize(game.db?.units ?? []));
  const ownedCount = $derived(new Map((game.payload?.owned ?? []).map((o) => [o.id, o.count])));
  const combos = $derived(new Map((game.payload?.combos ?? []).map((c) => [c.result, c])));

  function tip(u: Unit): string {
    const c = combos.get(u.id);
    const lines = [u.grade ? `${u.name} (${u.grade})` : u.name];
    if (u.title) lines.push(u.title);
    if (u.damageType) lines.push(u.damageType);
    if (c) lines.push(c.craftable ? '지금 조합 가능' : `재료 ${c.have}/${c.need}`);
    return lines.join('\n');
  }

  // ── 화면 맞춤: 내용이 영역보다 크면 transform: scale 로 줄인다 (스크롤 없음) ──
  let host: HTMLDivElement | undefined = $state();
  let content: HTMLDivElement | undefined = $state();
  let scale = $state(1);
  let contentWidth = $state(0);

  function fit() {
    if (!host || !content) return;
    const hw = host.clientWidth;
    const hh = host.clientHeight;
    if (!hw || !hh) return;
    // 1차: 원래 너비로 높이 측정
    let s = 1;
    let w = hw;
    for (let i = 0; i < 3; i++) {
      contentWidth = w;
      content.style.width = `${w}px`;
      const ch = content.scrollHeight;
      const next = Math.min(1, hh / ch);
      if (Math.abs(next - s) < 0.005) { s = next; break; }
      s = next;
      w = hw / s; // 줄인 만큼 너비를 넓혀 화면 폭을 채운다
    }
    scale = s;
    contentWidth = w;
  }

  $effect(() => {
    if (!host) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(host);
    return () => ro.disconnect();
  });
  // 데이터가 바뀌면 다시 맞춘다
  $effect(() => {
    void groups;
    void ownedCount;
    requestAnimationFrame(fit);
  });
</script>

<div class="fit-host" bind:this={host}>
  <div class="grid" bind:this={content} style:transform={`scale(${scale})`} style:width={contentWidth ? `${contentWidth}px` : undefined}>
    {#each CATEGORIES as cat (cat.id)}
      {@const list = groups.get(cat.id) ?? []}
      {#if list.length || !cat.rest}
        <section class="cat" class:rest={cat.rest}>
          <h3>{cat.title} <small>{list.length}</small></h3>
          <div class="tiles">
            {#each list as u (u.id)}
              {@const n = ownedCount.get(u.id) ?? 0}
              {@const c = combos.get(u.id)}
              {@const pct = c && c.need ? Math.round((c.have / c.need) * 100) : 0}
              <div class="tile" class:owned={n > 0} class:ready={c?.craftable} title={tip(u)}>
                <UnitIcon id={u.id} name={u.name} size={22} />
                <span class="nm-wrap">
                  {#if pct > 0}<span class="fill" style:width={`${pct}%`}></span>{/if}
                  <span class="nm">{u.name}</span>
                  {#if cat.rest}<span class="gr">{u.grade}</span>{/if}
                  {#if pct > 0}<span class="pct">{pct}%</span>{/if}
                </span>
                {#if n > 0}<span class="cnt">{n}</span>{/if}
              </div>
            {/each}
            {#if list.length === 0}<span class="empty">—</span>{/if}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .fit-host { position: relative; width: 100%; height: 100%; overflow: hidden; }
  /* 분류 하나가 한 줄을 차지하고, 높이는 타일 수만큼만 쓴다 */
  .grid {
    transform-origin: top left; box-sizing: border-box; padding: var(--sp-3) var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-2);
  }
  .cat { min-width: 0; }
  h3 { margin: 0 0 var(--sp-1); font-size: var(--fs-1); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-accent-text); border-bottom: 1px solid var(--c-border); padding-bottom: 2px; }
  h3 small { color: var(--c-text-3); margin-left: var(--sp-1); font-weight: 400; }
  .tiles { display: flex; flex-wrap: wrap; gap: 3px; }
  .tile {
    position: relative; display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 4px 0 2px; box-sizing: border-box;
    border: 1px solid var(--c-border); border-radius: var(--r-1); background: var(--c-bg-app); font-size: var(--fs-1); color: var(--c-text-2);
    overflow: hidden; user-select: none;
  }
  .tile:hover { color: var(--c-text); border-color: var(--c-border-strong); }
  .tile.owned { color: var(--c-text); border-color: var(--c-border-strong); background: var(--c-bg-input); }
  .tile.ready { border-color: var(--c-ok); }
  /* 이름 칸: 진행도만큼 왼쪽부터 채워지는 게이지 + 퍼센트 */
  .nm-wrap { position: relative; display: inline-flex; align-items: center; gap: 4px; height: 100%; padding: 0 4px; border-radius: var(--r-1); overflow: hidden; }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--c-accent-soft); }
  .ready .fill { background: color-mix(in srgb, var(--c-ok) 28%, transparent); }
  .nm { position: relative; white-space: nowrap; }
  .pct { position: relative; font-variant-numeric: tabular-nums; color: var(--c-accent-text); font-size: 10px; }
  .ready .pct { color: var(--c-ok-text); }
  .cnt { font-variant-numeric: tabular-nums; color: var(--c-accent-text); font-weight: 600; }
  .gr { position: relative; color: var(--c-text-3); }
  .empty { color: var(--c-text-3); font-size: var(--fs-1); }
</style>

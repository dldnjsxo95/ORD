<!-- 메인 뷰: 보유 유닛과 조합을 한 화면에. 배치는 사용자 지시에 따라 나중에 다시 짠다 (임시 구성). -->
<script lang="ts">
  import { game, unitLabel, unitName, unitGrade, gradeRank, ownedTotal } from '$lib/stores/game.svelte';
  import type { ComboStatus, Condition } from '$lib/api';
  import Pill from '$lib/ui/Pill.svelte';

  const owned = $derived(game.payload?.owned ?? []);
  const craftable = $derived(game.payload?.combos.filter((c) => c.craftable) ?? []);
  const pending = $derived(game.payload?.combos.filter((c) => !c.craftable && c.have > 0) ?? []);

  const COND_TEXT: Record<string, (c: Condition) => string> = {
    change_count: (c) => `변화 ${c.value}회`,
    skill_points: (c) => `특성 ${c.value}`,
    round_max: (c) => `${c.value}R까지`,
    random_pick: (c) => `랜덤전용 ${c.value}기`,
    greenblood: () => '그린블러드',
    unique: () => '1기 제한',
    king: () => '',
  };
  const condText = (c: Condition) => (COND_TEXT[c.type] ?? ((x: Condition) => `${x.type} ${x.value}`))(c);
  const tierClass = (grade: string | null | undefined) => `t${Math.min(Math.max(gradeRank(grade), 0), 16)}`;

  function costText(c: ComboStatus): string[] {
    const out: string[] = [];
    if (c.gold) out.push(`${c.gold.toLocaleString()}골드`);
    if (c.wood) out.push(`목재 ${c.wood}`);
    if (c.wood_incremental) out.push(`목재 ${c.wood_incremental}+`);
    for (const i of c.items) out.push(i.name);
    return out;
  }
</script>

<div class="panel">
  <p class="panel-sub cat first">보유 유닛 <span class="count">{ownedTotal()}</span></p>
  {#if owned.length === 0}
    <p class="empty">보유 유닛이 없습니다.</p>
  {:else}
    <div class="chips">
      {#each owned as o (o.id)}
        <span class="unit-chip {tierClass(unitGrade(o.id))}" class:unknown={!o.known} title={o.known ? `${unitLabel(o.id)} · ${o.id}` : `DB 에 없는 코드 ${o.id}`}>
          <span class="nm">{o.known ? unitName(o.id) : o.id}</span>
          {#if o.known && unitGrade(o.id)}<span class="gr">{unitGrade(o.id)}</span>{/if}
          {#if o.count > 1}<span class="n">×{o.count}</span>{/if}
        </span>
      {/each}
    </div>
  {/if}

  <p class="panel-sub cat">조합 가능 <span class="count">{craftable.length}</span></p>
  {#if craftable.length === 0}
    <p class="empty">지금 바로 만들 수 있는 조합이 없습니다.</p>
  {:else}
    <ul class="list">
      {#each craftable as c (c.recipe_id)}
        <li class="row ready">
          <span class="tier {tierClass(c.result_grade)}"></span>
          <span class="name">{c.result_name || c.result}</span>
          {#if c.result_grade}<span class="grade">{c.result_grade}</span>{/if}
          <span class="mats">{game.db?.recipes.find((r) => r.id === c.recipe_id)?.materials.map((m) => unitName(m.unit) + (m.count > 1 ? ` ×${m.count}` : '')).join(' + ')}</span>
          <span class="spacer"></span>
          {#each costText(c) as t}<Pill square>{t}</Pill>{/each}
          {#each c.conditions.filter((x) => condText(x)) as x}<Pill tone="warn" square>{condText(x)}</Pill>{/each}
          <Pill tone="ok" square>준비됨</Pill>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="panel-sub cat">진행 중 <span class="count">{pending.length}</span></p>
  {#if pending.length === 0}
    <p class="empty">—</p>
  {:else}
    <ul class="list">
      {#each pending as c (c.recipe_id)}
        <li class="row">
          <span class="tier {tierClass(c.result_grade)}"></span>
          <span class="name">{c.result_name || c.result}</span>
          {#if c.result_grade}<span class="grade">{c.result_grade}</span>{/if}
          <span class="progress mono">{c.have}/{c.need}</span>
          <span class="bar"><span class="fill" style:width={`${c.need ? (c.have / c.need) * 100 : 0}%`}></span></span>
          <span class="spacer"></span>
          <span class="missing">
            {#each c.missing as m (m.unit)}
              <Pill square title={m.unit}>{unitName(m.unit)} ×{m.count}</Pill>
            {/each}
            {#if c.gold_ok === false}<Pill tone="danger" square>{c.gold.toLocaleString()}골드</Pill>{/if}
            {#if c.wood_ok === false}<Pill tone="danger" square>목재 {c.wood + c.wood_incremental}</Pill>{/if}
            {#each c.items as i}<Pill tone="info" square>{i.name}</Pill>{/each}
            {#each c.conditions.filter((x) => condText(x)) as x}<Pill tone="warn" square>{condText(x)}</Pill>{/each}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .count { color: var(--c-text); margin-left: var(--sp-1); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
  .unit-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px 1px 4px; border-radius: var(--r-1);
    background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-left: 3px solid var(--c-border-strong); font-size: var(--fs-2);
  }
  .unit-chip.unknown { color: var(--c-text-3); font-family: var(--font-mono); }
  .unit-chip .gr { color: var(--c-text-3); font-size: var(--fs-1); }
  .unit-chip .n { font-variant-numeric: tabular-nums; color: var(--c-accent-text); }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-3); padding: 4px var(--sp-2); border-bottom: 1px solid var(--c-border-row); min-height: 24px; flex-wrap: wrap; }
  .row:hover { background: var(--c-bg-hover); }
  .row.ready .name { color: var(--c-ok-text); }
  .tier { width: 3px; height: 16px; border-radius: 1px; background: var(--c-border-strong); flex: none; }
  .name { white-space: nowrap; }
  .grade { color: var(--c-text-3); font-size: var(--fs-1); }
  .mats { color: var(--c-text-2); font-size: var(--fs-2); }
  .progress { color: var(--c-text-2); font-size: var(--fs-2); }
  .bar { width: 80px; height: 4px; background: var(--c-bg-input); border-radius: 2px; overflow: hidden; flex: none; }
  .fill { display: block; height: 100%; background: var(--c-accent); transition: width var(--dur-2) var(--ease); }
  .missing { display: inline-flex; gap: var(--sp-1); flex-wrap: wrap; justify-content: flex-end; }
  /* 등급 색: 순위 0(흔함)~16(오로성). 낮은 등급은 회색, 올라갈수록 녹→파→보→금→빨. */
  .t0, .t1 { --tier: var(--c-tier-1); } .t2, .t3 { --tier: var(--c-tier-2); } .t4, .t5, .t6 { --tier: var(--c-tier-3); }
  .t7, .t8, .t9, .t10 { --tier: var(--c-tier-4); } .t11, .t12, .t13, .t14, .t15, .t16 { --tier: var(--c-tier-5); }
  .tier[class*='t'] { background: var(--tier, var(--c-border-strong)); }
  .unit-chip[class*='t'] { border-left-color: var(--tier, var(--c-border-strong)); }
</style>

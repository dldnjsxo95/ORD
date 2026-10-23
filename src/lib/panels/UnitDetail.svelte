<!-- 조합 상세 모달: 유닛 행(이름 영역)을 클릭하면 열린다. 크기는 창의 절반.
     뒤로/앞으로는 상단 버튼 또는 마우스 옆 버튼(+page.svelte 에서 처리). 뒤로는 이전 유닛, 이전이 없으면 닫힘.
     왼쪽(75%): 유닛 헤더 + 정보 카드, 섹션 6개(부족한 재료 / 부족한 최하위 재료 / 하위 재료 / 최하위 재료 / 상위 조합 / 최상위 조합).
     오른쪽(25%): 남은 조합 (아직 만들어야 하는 중간 유닛, 낮은 등급부터).
     타일·항목을 클릭하면 그 유닛으로 이동하고 ← 로 돌아온다. 수량은 메인 화면과 같은 값(실시간 + 수동 조정)을 쓰므로
     +/− 로 바꾸면 즉시 다시 계산된다. -->
<script lang="ts">
  import { hoverCard, infoCard } from '$lib/actions/hover';
  import { detail, pushDetail, backDetail, forwardDetail, canForward, closeDetail } from '$lib/stores/detail.svelte';
  import { game, unit as unitOf, unitGrade } from '$lib/stores/game.svelte';
  import { effectiveCount, effectiveCounts } from '$lib/stores/plan.svelte';
  import { ENTRY_BY_ID } from '$lib/layout';
  import { BADGE_ICON } from '$lib/badges';
  import { shortage, directMaterials, baseMaterials, parents, topParents, craftRecipe, rankOf, baseOf as baseIdOf, type Need, type MissingDirect } from '$lib/combo-tree';
  import descriptionsJson from '../../../data/descriptions.json';
  import UnitIcon from '$lib/ui/UnitIcon.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  const DESCRIPTIONS = descriptionsJson as Record<string, string>;

  const id = $derived(detail.current);
  const unit = $derived(id ? unitOf(id) : undefined);
  const entry = $derived(id ? ENTRY_BY_ID.get(id) : undefined);
  const name = (u: string) => ENTRY_BY_ID.get(u)?.label ?? unitOf(u)?.name ?? u;
  const grade = (u: string) => unitGrade(u) ?? '';

  // 트리 계산. effectiveCount 가 plan/game 상태를 읽으므로 수량이 바뀌면 다시 계산된다.
  // 진화체는 그 유닛 1기를 더 가진 것으로 반영한다. 흔함선택위습은 부족 목록에서 빼지 않고 "위습으로 대체 가능한 수"로만 보여 준다
  // (위습으로 뽑을 수 있을 뿐 실제로 있는 유닛이 아니므로. 게이지와 같은 기준).
  const tree = $derived.by(() => {
    const db = game.db;
    if (!db || !id) return null;
    const counts = effectiveCounts();
    const count = (u: string) => counts.get(u) ?? 0;
    const evolution = game.payload?.state.evolution ?? null;
    const extra = evolution && baseIdOf(db, evolution) !== baseIdOf(db, id) ? new Map([[baseIdOf(db, evolution), 1]]) : undefined;
    const s = shortage(db, id, count, { extra, wisps: count('e018') });
    const base: Need[] = [...baseMaterials(db, id).entries()].map(([u, count]) => ({ id: u, count })).sort((a, b) => rankOf(db, a.id) - rankOf(db, b.id));
    return {
      direct: s.direct,
      missingBase: s.missingBase,
      wispsUsed: s.wispsUsed,
      lower: directMaterials(db, id),
      base,
      parents: parents(db, id),
      top: topParents(db, id),
      remaining: s.toCraft.map((n) => ({ ...n, materials: directMaterials(db, n.id) })),
    };
  });

  const materialsText = (ms: Need[]) => ms.map((m) => `${name(m.id)}${m.count > 1 ? ` × ${m.count}` : ''}`).join(' / ');

  // 다른 유닛으로 이동하면 양쪽 영역 스크롤을 맨 위로
  let leftEl: HTMLElement | undefined = $state();
  let rightEl: HTMLElement | undefined = $state();
  $effect(() => {
    void id;
    leftEl?.scrollTo(0, 0);
    rightEl?.scrollTo(0, 0);
  });

  // ESC 는 +page.svelte 에서 처리한다 (상세 모달 → 설정 → 전체화면 순)
</script>

{#if id && unit}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={closeDetail}>
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-modal="true" aria-label="조합 상세" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <header class="bar">
        <IconButton label={detail.stack.length ? '뒤로 (마우스 뒤로 버튼)' : '닫기 (마우스 뒤로 버튼)'} size="sm" onclick={backDetail}><span class="back"><Icon name="chevronRight" size={14} /></span></IconButton>
        <IconButton label="앞으로 (마우스 앞으로 버튼)" size="sm" disabled={!canForward()} onclick={forwardDetail}><Icon name="chevronRight" size={14} /></IconButton>
        <span class="crumbs">{detail.stack.map(name).concat(name(id)).join(' › ')}</span>
        <span class="spacer"></span>
        <IconButton icon="close" label="닫기 (ESC)" size="sm" onclick={closeDetail} />
      </header>

      <div class="cols">
        <!-- 왼쪽: 유닛 정보 -->
        <section class="left" bind:this={leftEl}>
          <div class="head">
            <div class="who">
              <UnitIcon id={unit.id} name={unit.name} size={32} />
              <span class="nm">{name(id)}</span>
              {#each entry?.badges ?? [] as b, i (i)}{#if BADGE_ICON[b]}<span class="badge {b}"><Icon name={BADGE_ICON[b]} size={12} /></span>{/if}{/each}
              {#if entry?.note}<span class="note">({entry.note})</span>{/if}
              {#if entry?.panel ?? unit.grade}<span class="gr">[{entry?.panel ?? unit.grade}]</span>{/if}
              <span class="cnt" use:hoverCard={() => infoCard('현재 보유', ['게임에서 읽은 수량 (가정 배정 전)'])}>보유 {effectiveCount(id)}</span>
            </div>
            {#if DESCRIPTIONS[id]}
              <div class="card">{DESCRIPTIONS[id]}</div>
            {/if}
          </div>

          {#if tree}
            {@const sections = [
              { title: '부족한 재료', items: tree.direct, pct: true, empty: craftRecipe(game.db!, id) ? '없음 (재료를 모두 보유)' : '조합식 없음' },
              { title: '부족한 최하위 재료', items: tree.missingBase, pct: false, empty: '없음', hint: tree.wispsUsed ? `위습으로 ${tree.wispsUsed}개 대체 가능` : '' },
              { title: '하위 재료', items: tree.lower, pct: false, empty: '없음 (최하위 유닛)' },
              { title: '최하위 재료', items: tree.lower.length ? tree.base : [], pct: false, empty: '없음' },
            ]}
            {#each sections as sec (sec.title)}
              <h3>{sec.title}{#if sec.hint} <span class="hint">({sec.hint})</span>{/if}</h3>
              {#if sec.items.length === 0}
                <div class="empty">{sec.empty}</div>
              {:else}
                <div class="tiles">
                  {#each sec.items as it (it.id)}
                    <button type="button" class="tile" onclick={() => pushDetail(it.id)}>
                      <UnitIcon id={it.id} name={name(it.id)} size={24} />
                      <span class="lbl">{name(it.id)}({grade(it.id)}){#if it.count > 1}{` × ${it.count}`}{/if}</span>
                      {#if sec.pct}{@const pct = (it as MissingDirect).pct}<span class="pct" class:done={pct >= 100}>{pct}%</span>{/if}
                    </button>
                  {/each}
                </div>
              {/if}
            {/each}

            {#each [{ title: '상위 조합', ids: tree.parents }, { title: '최상위 조합', ids: tree.top }] as sec (sec.title)}
              <h3>{sec.title}</h3>
              {#if sec.ids.length === 0}
                <div class="empty">없음</div>
              {:else}
                <div class="tiles wide">
                  {#each sec.ids as pid (pid)}
                    {@const e = ENTRY_BY_ID.get(pid)}
                    <button type="button" class="tile" onclick={() => pushDetail(pid)}>
                      <UnitIcon id={pid} name={name(pid)} size={24} />
                      <span class="lbl">
                        {#if e?.tier}<span class="tier">({e.tier})</span>{/if}{name(pid)}
                        {#each e?.badges ?? [] as b, i (i)}{#if BADGE_ICON[b]}<span class="badge {b}"><Icon name={BADGE_ICON[b]} size={10} /></span>{/if}{/each}
                      </span>
                      {#if e?.note}<span class="sub">({e.note})</span>{/if}
                      <span class="sub gr">[{e?.panel ?? grade(pid)}]</span>
                    </button>
                  {/each}
                </div>
              {/if}
            {/each}
          {/if}
        </section>

        <!-- 오른쪽: 남은 조합 -->
        <aside class="right" bind:this={rightEl}>
          <h3>남은 조합</h3>
          {#if !tree || tree.remaining.length === 0}
            <div class="empty">{tree && tree.lower.length ? '없음 (중간 재료를 모두 보유)' : '없음'}</div>
          {:else}
            <ul class="remain">
              {#each tree.remaining as r (r.id)}
                <li>
                  <button type="button" class="item" onclick={() => pushDetail(r.id)}>
                    <UnitIcon id={r.id} name={name(r.id)} size={22} />
                    <span class="txt">
                      <span class="l1">{name(r.id)}({grade(r.id)}){#if r.count > 1}{` × ${r.count}`}{/if}</span>
                      <span class="l2">{materialsText(r.materials)}</span>
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </aside>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 950; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c-bg-app) 70%, transparent); }
  .modal {
    width: 50vw; height: 50vh; min-width: 560px; min-height: 360px; display: flex; flex-direction: column; overflow: hidden;
    background: var(--c-bg-panel); border: 1px solid var(--c-border-strong); border-radius: var(--r-3); box-shadow: var(--shadow-pop); font-size: 11px;
  }
  .bar { display: flex; align-items: center; gap: var(--sp-2); height: 32px; padding: 0 var(--sp-2) 0 var(--sp-2); background: var(--c-bg-app); border-bottom: 1px solid var(--c-border); flex: none; }
  .back { display: inline-flex; transform: rotate(180deg); }
  .crumbs { color: var(--c-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spacer { flex: 1; }
  .cols { display: grid; grid-template-columns: 3fr 1fr; flex: 1; min-height: 0; }
  .left { overflow: auto; padding: var(--sp-3) var(--sp-5) var(--sp-5); border-right: 1px solid var(--c-border); }
  .right { overflow: auto; padding: var(--sp-3) var(--sp-4) var(--sp-5); }

  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); margin-bottom: var(--sp-2); }
  .who { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; flex-wrap: wrap; }
  .who .nm { font-size: 15px; font-weight: 700; color: var(--c-text); }
  .who .note { color: var(--c-text-3); }
  .who .gr { color: var(--c-accent-text); font-weight: 600; }
  .who .cnt { color: var(--c-text-2); padding: 0 6px; border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .card { flex: none; max-width: 40%; white-space: pre-line; line-height: 1.5; padding: var(--sp-2) var(--sp-4); color: var(--c-text-2); background: var(--c-bg-app); border: 1px solid var(--c-border-strong); border-radius: var(--r-3); }

  h3 { margin: var(--sp-4) 0 var(--sp-2); font-size: 11px; font-weight: 600; color: var(--c-accent-text); text-transform: none; }
  .right h3 { margin-top: 0; }
  h3 .hint { font-weight: 400; color: var(--c-text-3); }
  .empty { color: var(--c-text-3); padding: 2px 0; }

  /* 타일: 배경 없이 초상화 + 글자만. 최대화(가로 2048px) 기준 왼쪽 영역 약 736px 에 한 줄 10개 (66px + 간격 6px) */
  .tiles { display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .tile {
    width: 66px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 3px 1px; text-align: center;
    border: 1px solid transparent; border-radius: var(--r-2); background: none; color: var(--c-text); font: inherit; font-size: 9px; cursor: pointer;
  }
  .tile:hover { border-color: var(--c-border-strong); background: var(--c-bg-hover); }
  .tile .lbl { line-height: 1.25; overflow-wrap: anywhere; }
  .tile .sub { font-size: 8px; color: var(--c-text-3); line-height: 1.25; overflow-wrap: anywhere; }
  .tile .gr { color: var(--c-accent-text); }
  .tile .pct { font-weight: 600; color: var(--c-warn-text); font-variant-numeric: tabular-nums; }
  .tile .pct.done { color: var(--c-ok-text); }
  .tier { font-weight: 700; color: var(--c-text-3); margin-right: 1px; }
  .badge { display: inline-flex; vertical-align: middle; }
  .badge.flag { color: var(--c-danger); } .badge.sword { color: var(--c-text-2); }
  .badge.heart-blue { color: var(--c-accent-text); } .badge.heart-red { color: var(--c-danger-text); } .badge.heart-white { color: var(--c-text); } .badge.plus { color: var(--c-text); }

  .remain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .item { width: 100%; display: flex; align-items: center; gap: var(--sp-2); padding: 2px 4px; text-align: left; border: 1px solid transparent; border-radius: var(--r-2); background: none; color: var(--c-text); font: inherit; font-size: 10px; cursor: pointer; }
  .item:hover { border-color: var(--c-border-strong); background: var(--c-bg-hover); }
  .item .txt { display: flex; flex-direction: column; min-width: 0; }
  .item .l1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item .l2 { font-size: 9px; color: var(--c-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>

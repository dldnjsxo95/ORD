<!-- 설정 내용 (SettingsDialog 모달 안): 감시 폴더(바꾸면 즉시 반영), 테마, 정보. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ui, setTheme } from '$lib/stores/ui.svelte';
  import { game, changeDir, defaultDir } from '$lib/stores/game.svelte';
  import { upgrade, setUpgradeLevel, saveUpgrade, resetUpgrade, MAX_LEVEL } from '$lib/stores/upgrade.svelte';
  import { difficultyProfile } from '$lib/difficulty';
  import Button from '$lib/ui/Button.svelte';

  /** 게임에서 읽은 난이도 → 적 이속·이감 상한·스턴 저항 */
  const profile = $derived(difficultyProfile(game.payload?.state.difficulty));

  let draft = $state('');
  let fallback = $state('');
  onMount(async () => {
    fallback = await defaultDir();
  });
  // 바깥(초기화 등)에서 폴더가 바뀌면 입력 칸도 따라간다.
  $effect(() => {
    draft = game.dir;
  });

  async function apply() {
    if (draft.trim() === game.dir) return;
    await changeDir(draft);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === 'Escape') draft = game.dir;
  }
</script>

<div class="panel">
  <p class="panel-sub cat first">데이터 소스</p>
  <div class="setting">
    <div class="label">감시 폴더 <span class="hint">state.json 이 기록되는 위치. 바꾸면 바로 적용됩니다.</span></div>
    <div class="control">
      <input class="mono" type="text" bind:value={draft} onblur={apply} onkeydown={onKey} spellcheck="false" placeholder={fallback} />
      <Button size="sm" variant="ghost" disabled={!game.dir || game.dir === fallback} title={fallback} onclick={() => void changeDir('')}>기본값</Button>
    </div>
  </div>
  <div class="setting">
    <div class="label">상태</div>
    <div class="control">
      <span class="dot" class:on={game.watching}></span>
      <span class="hint">{game.watching ? `감시 중 · ${game.dir}` : '감시가 시작되지 않았습니다'}</span>
    </div>
  </div>

  <p class="panel-sub cat">화면</p>
  <div class="setting">
    <div class="label">테마</div>
    <div class="control">
      <Button size="sm" variant={ui.theme === 'dark' ? 'active' : 'ghost'} onclick={() => setTheme('dark')}>어두운</Button>
      <Button size="sm" variant={ui.theme === 'light' ? 'active' : 'ghost'} onclick={() => setTheme('light')}>밝은</Button>
    </div>
  </div>

  <p class="panel-sub cat">계산 가정 <span class="hint">현재 능력치의 아머브레이크 환산과 "실전 효과" 패널 계산에 쓰입니다</span></p>
  <div class="setting">
    <div class="label">업그레이드 레벨 <span class="hint">모든 등급 공통. 공속 = 레벨 1 기본 증가량 + 레벨당 증가폭 (맵 데이터)</span></div>
    <div class="control">
      <input class="range" type="range" min="0" max={MAX_LEVEL} step="1" value={upgrade.level} oninput={(e) => setUpgradeLevel(Number((e.currentTarget as HTMLInputElement).value))} />
      <span class="mono lv">Lv {upgrade.level}{upgrade.level === MAX_LEVEL ? ' (풀강)' : upgrade.level === 0 ? ' (미연구)' : ''}</span>
    </div>
  </div>
  <div class="setting">
    <div class="label">공격속도 상한 <span class="hint">워크래프트 3 기본 400%</span></div>
    <div class="control">
      <input class="mono num" type="number" min="100" max="1000" step="25" value={upgrade.speedCap} onchange={(e) => { upgrade.speedCap = Math.max(100, Number((e.currentTarget as HTMLInputElement).value) || 400); saveUpgrade(); }} />
      <span class="hint">%</span>
    </div>
  </div>
  <div class="setting">
    <div class="label">신비 최종 공속 +25% <span class="hint">랜덤전용 업그레이드 설명 기준</span></div>
    <div class="control">
      <Button size="sm" variant={upgrade.mysticBonus ? 'active' : 'ghost'} onclick={() => { upgrade.mysticBonus = true; saveUpgrade(); }}>적용</Button>
      <Button size="sm" variant={!upgrade.mysticBonus ? 'active' : 'ghost'} onclick={() => { upgrade.mysticBonus = false; saveUpgrade(); }}>미적용</Button>
      <Button size="sm" variant="ghost" onclick={resetUpgrade}>가정 초기화</Button>
    </div>
  </div>

  <div class="setting">
    <div class="label">스턴 저항 <span class="hint">적 스턴 지속 감소율. 자동이면 게임 난이도로 결정 (신·악몽 50%, 그 아래 0%). 라인몹에도 동일 적용</span></div>
    <div class="control">
      <Button size="sm" variant={upgrade.stunAuto ? 'active' : 'ghost'} onclick={() => { upgrade.stunAuto = true; saveUpgrade(); }}>난이도 자동</Button>
      <Button size="sm" variant={!upgrade.stunAuto ? 'active' : 'ghost'} onclick={() => { upgrade.stunAuto = false; saveUpgrade(); }}>수동</Button>
      {#if upgrade.stunAuto}
        <span class="hint">{profile.name ? `감지된 난이도 ${profile.name} → ${profile.stunResist}%` : '난이도 미감지 (신 기준 50% 가정)'}</span>
      {:else}
        <input class="mono num" type="number" min="0" max="100" step="1" value={upgrade.stunResist} onchange={(e) => { upgrade.stunResist = Math.max(0, Math.min(100, Number((e.currentTarget as HTMLInputElement).value) || 0)); saveUpgrade(); }} />
        <span class="hint">%</span>
      {/if}
    </div>
  </div>
  <div class="setting">
    <div class="label">난이도 <span class="hint">게임에서 자동으로 읽음. 적 이속·이감 상한·스턴 저항에 반영</span></div>
    <div class="control hint">
      {profile.name ?? '미감지'} · 적 이속 {Math.round(profile.enemySpeed)} (기본 {profile.baseSpeed}{profile.aura ? ` × 오라 ${Math.round(100 + profile.aura * 100)}%` : ''}) · 풀이감 {Math.round(profile.fullSlow * 100)}%
    </div>
  </div>
  <div class="setting">
    <div class="label">전투 시간 <span class="hint">실전 효과의 방어력 감소에서 아머브레이크가 쌓이는 시간</span></div>
    <div class="control">
      <input class="mono num" type="number" min="1" max="300" step="1" value={upgrade.fightSeconds} onchange={(e) => { upgrade.fightSeconds = Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 20); saveUpgrade(); }} />
      <span class="hint">초</span>
    </div>
  </div>

  <p class="panel-sub cat">정보</p>
  <div class="setting">
    <div class="label">조합 DB</div>
    <div class="control hint">v{game.db?.version ?? '-'} · 유닛 {game.db?.units.length ?? 0}종 · 조합식 {game.db?.recipes.length ?? 0}개</div>
  </div>
  <div class="setting">
    <div class="label">데이터 흐름</div>
    <div class="control hint">TMO.GG Desktop → scripts/ord-export.lua → state.json → 이 앱</div>
  </div>
</div>

<style>
  .setting { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-2) 0; border-bottom: 1px solid var(--c-border-row); }
  .label { width: 200px; flex: none; }
  .label .hint { display: block; }
  .control { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 0; }
  input {
    flex: 1; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 var(--sp-3); font-size: var(--fs-2);
    color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1);
  }
  input:focus { outline: 1px solid var(--c-focus); outline-offset: -1px; }
  input.range { flex: 0 1 240px; height: 20px; padding: 0; border: none; background: transparent; accent-color: var(--c-ok-text); }
  input.num { flex: 0 0 80px; }
  .lv { min-width: 90px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-text-3); flex: none; }
  .dot.on { background: var(--c-ok-text); }
</style>

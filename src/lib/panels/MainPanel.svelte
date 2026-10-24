<!-- 메인 뷰 (사용자 사양 2026-10-23): 상단 툴바 → 능력치 필터 → 8열 패널 (data/layout.json).
     수량은 실시간 보유량 + 수동 조정(+/−). 수동 조정이 있으면 백엔드 simulate 로 조합을 다시 계산한다. -->
<script lang="ts">
  import { game, unit as unitOf } from '$lib/stores/game.svelte';
  import { fullscreen, toggleFullscreen } from '$lib/stores/fullscreen.svelte';
  import { plan, effectiveCount, effectiveCounts, rawCount, adjust, resetAll, clearManual, hasManual, toggleAssumed, clearAssumed, setGreenBlood, setSort, toggleFilter, clearFilters, setFilterOpen, combos, onLiveUpdate, type SortMode } from '$lib/stores/plan.svelte';
  import { COLUMNS, ALL_PANELS, ENTRY_BY_ID, FILTERS, type Entry } from '$lib/layout';
  import { traitsOf, statsOfNote } from '$lib/traits';
  import { abReport, fmtAb, AB_MAX } from '$lib/armor-break';
  import { stunReport, pct } from '$lib/stun';
  import { difficultyProfile, enemySpeedWithSlow } from '$lib/difficulty';
  import { procSlowReport } from '$lib/proc-slow';
  import stackJson from '../../../data/stack-groups.json';

  /** 유닛 id → 라벨별 중첩 그룹 (맵 스크립트에서 추출). 같은 그룹은 게임이 하나만 인정 */
  const STACK_GROUPS = (stackJson as { units: Record<string, Record<string, string[]>> }).units;
  import { upgrade } from '$lib/stores/upgrade.svelte';
  import { openDetail } from '$lib/stores/detail.svelte';
  import { allocate, usedByGrade, compareUsage, type Holdings } from '$lib/combo-tree';
  import { hoverCard, infoCard, unitCard } from '$lib/actions/hover';
  import type { Unit } from '$lib/api';
  import CategoryPanel from './CategoryPanel.svelte';
  import UnitRow from './UnitRow.svelte';
  import NavRow from './NavRow.svelte';
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

  /**
   * 현재 능력치: 보유 유닛(수량 반영)과 보유 아이템의 괄호 요약을 라벨별로 합산한다.
   * 숫자가 붙은 토큰은 부호 포함 합산(이감40 + 이감-15 = 25, 깍20 + 깍-15 = 5, 0.5스턴 + 1스턴 = 1.5), 숫자가 없는 토큰(암브 등)은 보유 개수.
   */
  const stats = $derived.by(() => {
    type Part = { name: string; n: number; value: number | null; token: string; /** 중첩 그룹에 밀려 미적용 (적용된 유닛 이름) */ suppressedBy?: string };
    const acc = new Map<string, { sum: number; count: number; numeric: boolean; parts: Part[] }>();
    /** 게임 중첩 그룹 (data/stack-groups.json): 같은 라벨·같은 그룹은 하나(큰 값)만 인정. 그룹 밖 유닛·아이템은 자기 혼자 그룹 */
    const groupKey = (id: string | undefined, label: string): string => {
      const g = id ? STACK_GROUPS[id]?.[label] : undefined;
      return g?.length ? `g:${g[0]}` : `u:${id ?? Math.random()}`;
    };
    const pending = new Map<string, Array<{ key: string; part: Part }>>();
    const add = (id: string | undefined, name: string, note: string | undefined, n: number) => {
      for (const s of statsOfNote(note)) {
        const list = pending.get(s.label) ?? [];
        list.push({ key: groupKey(id, s.label), part: { name, n, value: s.value, token: s.token } });
        pending.set(s.label, list);
      }
    };
    for (const u of game.db?.units ?? []) {
      const n = effectiveCount(u.id);
      if (!n) continue;
      const e = ENTRY_BY_ID.get(u.id);
      add(u.id, e?.label ?? u.name, e?.note, n);
    }
    for (const p of ALL_PANELS) {
      if (p.kind !== 'items') continue;
      for (const e of p.entries ?? []) {
        const n = e.id ? itemCount(e.id) : 0;
        if (n) add(undefined, e.label ?? e.id ?? '', e.note, n);
      }
    }
    // 그룹 적용: 같은 그룹은 값이 가장 큰 하나만 1회 센다 (같은 유닛 2기도 1회). 숫자 없는 토큰은 그룹 무관하게 개수.
    for (const [label, list] of pending) {
      const cur = { sum: 0, count: 0, numeric: false, parts: [] as Part[] };
      const best = new Map<string, number>();
      for (let i = 0; i < list.length; i++) {
        const { key, part } = list[i];
        if (part.value == null || key.startsWith('u:')) continue;
        const b = best.get(key);
        if (b == null || Math.abs(part.value) > Math.abs(list[b].part.value ?? 0)) best.set(key, i);
      }
      list.forEach(({ key, part }, i) => {
        cur.count += part.n;
        if (part.value == null) { cur.parts.push(part); return; }
        cur.numeric = true;
        if (key.startsWith('u:')) { cur.sum += part.value * part.n; cur.parts.push(part); return; }
        const winner = best.get(key)!;
        if (winner === i) { cur.sum += part.value; cur.parts.push({ ...part, n: 1 }); }
        else cur.parts.push({ ...part, suppressedBy: list[winner].part.name });
      });
      acc.set(label, cur);
    }
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));

    // 아머브레이크: 개수 대신 "초당 깍 환산" 한 줄로. 공속·마젠 합계는 위에서 모은 현재 능력치를 그대로 쓴다.
    const speedBuff = acc.get('공격속도 증가')?.sum ?? 0;
    const manaBuff = acc.get('마나 재생')?.sum ?? 0;
    acc.delete('아머브레이크');
    acc.delete('단일아머브레이크');
    // 그린블러드를 부여한 유닛은 1기만 떼어 별도 항목(greenBlood)으로 넣는다 (기록지침 1개 → 1기에만 적용)
    const owned = (game.db?.units ?? []).flatMap((u) => {
      const n = effectiveCount(u.id);
      const base = { id: u.id, name: ENTRY_BY_ID.get(u.id)?.label ?? u.name, grade: u.grade };
      if (plan.greenBlood === u.id && n > 0) return [{ ...base, count: 1, greenBlood: true }, { ...base, count: n - 1 }];
      return [{ ...base, count: n }];
    });
    const ab = abReport(owned, speedBuff, manaBuff, upgrade);
    const abParts: Array<{ text: string; muted?: boolean; warn?: boolean; ok?: boolean }> = [];
    if (ab.units.length) {
      abParts.push({ text: `75까지 약 ${Math.round(ab.secondsToMax ?? 0)}초 · 공속 버프 합계 ${fmt(speedBuff)}% · 마젠 버프 ${fmt(manaBuff)}`, muted: true });
      for (const u of ab.units) {
        const who = u.count > 1 ? `${u.name} ×${u.count}` : u.name;
        abParts.push({ text: `${who} : 초당 ${fmtAb(u.perSec)}` + (u.count > 1 ? ` (1기 ${fmtAb(u.each)})` : '') });
        const s = u.speed;
        const spd = `공속 ${fmt(s.total)}%${s.capped ? ' (상한)' : ''} = 업그레이드 Lv${upgrade.level} ${fmt(s.fromUpgrade)} + 버프 ${fmt(s.fromBuff)}${s.mystic ? ' · 신비 ×1.25' : ''} → ${fmtAb(s.attacksPerSec)}회/초`;
        abParts.push({ text: `└${spd}`, muted: true });
        for (const k of u.skills) {
          if (k.perSec === 0 && k.how === '미계산') abParts.push({ text: `└${k.name} : ${k.note ?? '미계산'}`, muted: true });
          else abParts.push({ text: `└${k.name}${k.single ? ' (단일)' : ''} ${fmtAb(k.perSec)}/초 — ${k.how}${k.note ? ` · ${k.note}` : ''}`, muted: true });
        }
        abParts.push({ text: `└풀강 ${fmt(s.atMax)}% → 상한 ${upgrade.speedCap}%까지 버프 여유 ${fmt(s.headroomAtMax)}%`, muted: true, warn: s.headroomAtMax <= 0 });
      }
      abParts.push({ text: '발동 확률·회복량의 기대값(평균), 적 1기 기준, AB 1 = 방어력 1 감소 (최대 75). 업그레이드 레벨은 설정에서', muted: true });
    }
    const abRow = ab.units.length
      ? [{ label: '아머브레이크', text: `${fmtAb(ab.perSec)}/초`, negative: false, order: ab.perSec, parts: abParts, ab: true }]
      : [];

    // 호버 내역: 기여가 큰 순. "이름 ×n  토큰 → 합" (숫자 없는 토큰은 토큰만)
    const toLines = (parts: Part[]): Array<{ text: string; warn?: boolean; done?: boolean }> =>
      [...parts]
        .sort((a, b) => (a.suppressedBy ? 1 : 0) - (b.suppressedBy ? 1 : 0) || Math.abs((b.value ?? 0) * b.n) - Math.abs((a.value ?? 0) * a.n))
        .map((p) => {
          const who = p.n > 1 ? `${p.name} ×${p.n}` : p.name;
          if (p.suppressedBy) return { text: `${who} : ${p.token} — ${p.suppressedBy}와 같은 그룹이라 미적용`, done: true };
          if (p.value == null) return { text: `${who} : ${p.token}` + (p.n > 1 ? ` (${p.n})` : '') };
          return { text: `${who} : ${p.token}` + (p.n > 1 ? ` → ${fmt(p.value * p.n)}` : ''), warn: p.value < 0 };
        });
    const rows = [...abRow, ...[...acc.entries()]
      .map(([label, v]) => ({ label, text: v.numeric ? fmt(v.sum) : String(v.count), negative: v.numeric && v.sum < 0, order: v.numeric ? Math.abs(v.sum) : v.count, parts: toLines(v.parts), ab: false }))
      .sort((a, b) => b.order - a.order)];
    return {
      rows, ab, owned, speedBuff, manaBuff,
      sum: (label: string) => acc.get(label)?.sum ?? 0,
      count: (label: string) => acc.get(label)?.count ?? 0,
      parts: (label: string) => toLines(acc.get(label)?.parts ?? []),
    };
  });

  /**
   * 실전 효과: 현재 능력치를 전투 지표로 합친 값.
   * 방어력 감소(실질) = 상시 깍 + 단일깍 + 발동깍(발동 중 가정) + 아머브레이크 누적(초당 × 전투 시간, 최대 75)
   * 정지율 = 1 − (1 − 이감) × (1 − 스턴 가동률). 스턴 가동률은 stun.ts (겹침·저항 반영).
   */
  const effects = $derived.by(() => {
    const s = stats;
    const up = upgrade;
    type Line = { text: string; muted?: boolean; warn?: boolean; ok?: boolean };
    const rows: Array<{ label: string; text: string; title: string; lines: Line[]; danger?: boolean }> = [];
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));

    // 1. 방어력 감소 (실질)
    const flat = s.sum('방어력 감소');
    const single = s.sum('단일방어력 감소');
    const proc = s.sum('발동방어력 감소');
    const abAcc = Math.min(AB_MAX, s.ab.perSec * up.fightSeconds);
    const armor = flat + single + proc + abAcc;
    if (armor !== 0 || s.count('중첩방어력 감소') > 0) {
      const lines: Line[] = [{ text: `상시 깍 ${f(flat)}` + (single ? ` + 단일깍 ${f(single)} (단일 대상 기준)` : '') }];
      if (proc) lines.push({ text: `발동깍 ${f(proc)} — 발동 중 가정 (가동률 미반영)`, warn: true });
      if (s.ab.perSec > 0) lines.push({ text: `아머브레이크 ${f(abAcc)} — 초당 ${fmtAb(s.ab.perSec)} × 전투 ${up.fightSeconds}초 (최대 ${AB_MAX})` });
      if (s.count('중첩방어력 감소')) lines.push({ text: `중첩깍 ${s.count('중첩방어력 감소')}기 — 수치 없음, 미반영`, muted: true });
      for (const p of [...s.parts('방어력 감소'), ...s.parts('단일방어력 감소'), ...s.parts('발동방어력 감소')]) lines.push({ text: `└ ${p.text}`, muted: true, warn: p.warn });
      lines.push({ text: '전투 시간은 설정에서. 같은 어빌리티를 공유하는 유닛(봉쿠레·이완코브 뉴카마 등)은 실제로 한 번만 적용될 수 있음', muted: true });
      rows.push({ label: '방어력 감소', text: f(armor), title: '방어력 감소 (실질)', lines });
    }

    // 2. 마법 방어 감소
    const magic = s.sum('마법 방어력 감소');
    if (magic) rows.push({ label: '마법 방어 감소', text: f(magic), title: '마법 방어력 감소', lines: s.parts('마법 방어력 감소').map((p) => ({ text: `└ ${p.text}`, muted: true, warn: p.warn })) });

    // 3. 적 이속 · 정지율 (사용자 결정 2026-10-24)
    //    적 이속: 이감이 없을 때를 100% 로 두고 이감 합계만큼 뺀 값. 맵 최저 이속(89)까지 내려가면 더 안 느려지므로 "최저"로 빨갛게 표시.
    //    난이도(게임에서 자동 감지)에 따라 적 기본 이속(=이감 상한)과 스턴 저항이 달라진다 (difficulty.ts).
    //    정지율: 범위 스턴만의 가동률. 단일 스턴은 한 기만 멈추므로 제외(참고로만 표시).
    const prof = difficultyProfile(game.payload?.state.difficulty);
    const resist = up.stunAuto ? prof.stunResist : up.stunResist;
    const st = stunReport(s.owned, s.speedBuff, s.manaBuff, { ...up, stunResist: resist });
    // 이감 합계는 부호 포함(야마토·나스쥬로 −15 등). 적 이속 = (300 + 난이도 가산) × (1 + 오라 − 이감), 최저 89 · 최대 490.
    // 최저에 닿는 이감이 풀이감(신 102 · 악몽 112). 라인 이속 % 는 이감 없을 때를 100 으로 본 비율.
    // 발동이감: 수치 × 가동률(공속·확률·지속)의 기대값을 오라 이감에 더한다. 단일 대상은 참고만 (proc-slow.ts)
    const ps = procSlowReport(s.owned, s.speedBuff, s.manaBuff, up);
    const auraSlow = s.sum('이동속도 감소') / 100;
    const procSlow = ps.expected / 100;
    const slowRaw = auraSlow + procSlow;
    const atFloor = slowRaw >= prof.fullSlow;
    const atCeil = slowRaw < 0 && slowRaw <= prof.speedUpCap;
    const speedNow = enemySpeedWithSlow(prof, slowRaw);
    const speedPct = (speedNow / prof.enemySpeed) * 100;
    const envLine: Line = { text: `난이도 ${prof.name ?? '미감지 (신 가정)'} · 적 이속 ${Math.round(prof.enemySpeed)} (기본 ${prof.baseSpeed}${prof.aura ? ` × 오라 ${f(100 + prof.aura * 100)}%` : ''}) · 풀이감 ${f(prof.fullSlow * 100)}% · 스턴 저항 ${resist}%${up.stunAuto ? ' (자동)' : ' (수동)'}`, muted: true };
    {
      const lines: Line[] = [
        { text: `오라 이감 ${f(auraSlow * 100)}% + 발동이감 기대 ${f(procSlow * 100)}% = ${f(slowRaw * 100)}% / 풀이감 ${f(prof.fullSlow * 100)}% → 적 이속 ${Math.round(speedNow)} = 평소의 ${f(speedPct)}%` + (atFloor ? ' (최저 이속 89 도달)' : atCeil ? ' (최대 이속 490 도달)' : ''), ok: !atFloor && !atCeil, warn: atFloor || atCeil },
        { text: `계산: (${prof.baseSpeed}) × (1 + 오라 ${f(prof.aura * 100)}% − 이감 ${f(slowRaw * 100)}%) — 오라·이감은 퍼센트끼리 더한 뒤 곱함`, muted: true },
        envLine,
      ];
      for (const p of s.parts('이동속도 감소')) lines.push({ text: `└ ${p.text}`, muted: true, warn: p.warn });
      for (const u of ps.units) {
        const who = u.count > 1 ? `${u.name} ×${u.count}` : u.name;
        lines.push({ text: `${who} : 발동이감 기대 ${f(u.expected)}%` + (u.expectedSingle > 0 ? ` · 단일 ${f(u.expectedSingle)}% (미반영)` : '') });
        for (const k of u.lines) lines.push({ text: `└ ${k.name}${k.single ? ' (단일, 미반영)' : ''} ${k.value}% × 가동률 ${pct(k.uptime)} = ${f(k.expected)}% — ${k.how}${k.note ? ` · ${k.note}` : ''}`, muted: true });
      }
      lines.push({ text: '같은 그룹의 이감(키드 3등급 등)은 게임에서 하나만 적용되므로 실제는 이보다 덜 깎일 수 있음', muted: true });
      rows.push({ label: '라인 이속', text: `${f(speedPct)}%${atFloor ? ' 최저' : atCeil ? ' 최대' : ''}`, title: `라인 이속 — 이감 없을 때 100%. 풀이감 ${f(prof.fullSlow * 100)}%(${prof.name ?? '신 가정'})에서 최저 이속 89, 음수 이감은 최대 490 까지`, lines, danger: atFloor || atCeil });
    }
    if (st.lambda > 0 || st.lambdaSingle > 0) {
      const lines: Line[] = [
        { text: `범위 스턴 초당 ${fmtAb(st.lambda)}초 (겹침 전) · 저항 ${resist}% · 겹치면 긴 쪽만 남는 것으로 환산`, muted: true },
        envLine,
      ];
      for (const u of st.units) {
        const who = u.count > 1 ? `${u.name} ×${u.count}` : u.name;
        lines.push({ text: `${who} : 범위 ${pct(u.alone)} (초당 ${fmtAb(u.lambda)}초)` + (u.lambdaSingle > 0 ? ` · 단일 초당 ${fmtAb(u.lambdaSingle)}초 (미반영)` : '') });
        for (const k of u.skills) lines.push({ text: `└ ${k.name}${k.single ? ' (단일, 미반영)' : ''} ${fmtAb(k.perSec)} — ${k.how}${k.note ? ` · ${k.note}` : ''}`, muted: true });
      }
      lines.push({ text: '정지율 = 범위 스턴으로 멈춰 있는 시간 비율. 단일 스턴은 한 기만 멈춰 라인 전체엔 효과가 없다고 보고 제외', muted: true });
      rows.push({ label: '정지율', text: pct(st.uptime), title: '정지율 — 범위 스턴으로 멈춰 있는 시간 비율', lines });
    }

    // 4. 보스 특화 (수치 정리 전: 보유 기수만)
    const bossParts = new Map<string, Line>();
    for (const p of s.parts('보스 잡기')) bossParts.set(p.text, { text: `└ ${p.text}`, muted: true });
    for (const p of s.parts('광폭화 잡기')) if (!bossParts.has(p.text)) bossParts.set(p.text, { text: `└ ${p.text}`, muted: true });
    if (bossParts.size) rows.push({ label: '보스 특화', text: `${bossParts.size}기`, title: '보스·광폭화 잡기 보유 (수치 정리 예정)', lines: [...bossParts.values(), { text: '보스 관련 수치는 추후 이감·깍처럼 정리', muted: true }] });

    return rows;
  });

  /** 그린블러드 부여 후보: 보유 중인 전설·히든 유닛 (현재 지정된 유닛은 수량이 0이어도 목록에 남긴다) */
  const greenBloodTargets = $derived.by(() => {
    const list = (game.db?.units ?? [])
      .filter((u) => /전설|히든/.test(u.grade ?? '') && (effectiveCount(u.id) > 0 || plan.greenBlood === u.id))
      .map((u) => ({ id: u.id, name: `${ENTRY_BY_ID.get(u.id)?.label ?? u.name} (${u.grade})` }));
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
      <button type="button" class="link" onclick={resetAll}>전체 초기화</button>
      {#if hasManual()}<Button size="sm" variant="ghost" onclick={clearManual}>실시간 값으로 복귀</Button>{/if}
      {#if plan.assumed.length}
        <span class="assumed">가정:
          {#each plan.assumed as id (id)}<button type="button" class="chip" use:hoverCard={() => unitCard(id, ['우클릭으로 가정한 유닛. 누르면 해제'])} onclick={() => toggleAssumed(id)}>{assumedName(id)} ✕</button>{/each}
          <button type="button" class="link" onclick={clearAssumed}>모두 해제</button>
        </span>
      {/if}
    </span>
    <span class="spacer"></span>
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
        <label class="f" class:on={filterSet.has(f)} use:hoverCard={() => infoCard(f, [filterSet.has(f) ? '필터 켜짐 (누르면 끔)' : '누르면 이 특징을 가진 유닛만 남김'])}>
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
                  <UnitRow unit={r.unit} label={r.entry.label} note={r.entry.note} badges={r.entry.badges} tier={r.entry.tier} count={countOf(r.unit)} combo={comboByResult.get(r.unit.id)} dimmed={!matches(r.unit)} adjustable={!live} counts={ctxFor(r.unit.id).counts} wisps={ctxFor(r.unit.id).wisps} evolution={ctxFor(r.unit.id).evolution} assumed={plan.assumed.includes(r.unit.id)} greenBlood={plan.greenBlood === r.unit.id} onassume={() => toggleAssumed(r.unit!.id)} onadjust={(d) => adjust(r.unit!.id, d)} onopen={() => openDetail(r.unit!.id)} />
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
            <CategoryPanel id={p.id} title={p.title} count={stats.rows.length}>
              {#each stats.rows as s (s.label)}
                <div
                  class="kv"
                  use:hoverCard={() =>
                    s.ab
                      ? infoCard('아머브레이크 → 초당 깍 환산', [{ text: `합계 초당 ${s.text.replace('/초', '')} (AB 1 = 방어력 1)`, ok: true }, ...s.parts])
                      : infoCard(s.label, [{ text: `합계 ${s.text}`, ok: true }, ...s.parts, { text: '괄호 요약 숫자를 부호 포함 합산 (괄호 요약이 있는 모든 등급·아이템 포함)', muted: true }])}
                ><span class="k">{s.label}</span><span class="v mono" class:neg={s.negative}>{s.text}</span></div>
              {/each}
              {#if stats.rows.length === 0}<div class="empty">보유 유닛 없음</div>{/if}
            </CategoryPanel>
          {:else if p.kind === 'effects'}
            <CategoryPanel id={p.id} title={p.title} count={effects.length}>
              <div class="kv gb" use:hoverCard={() => infoCard('그린블러드 (기록지침, 신모드 이상)', ['전설·히든 유닛 1기에 부여: 공격속도 +30%, 3초마다 825범위 1.2초 스턴', '지정한 유닛 1기에만 반영 (같은 유닛이 여러 기여도 1기)', '정지율·방어력 감소(암브 공속) 계산에 들어감. 게임에서 읽을 수 없어 직접 지정', { text: '전체 초기화로 해제', muted: true }])}>
                <span class="k">그린블러드</span>
                <select class="gbsel mono" value={plan.greenBlood ?? ''} onchange={(e) => setGreenBlood((e.currentTarget as HTMLSelectElement).value || null)}>
                  <option value="">미지정</option>
                  {#each greenBloodTargets as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
                </select>
              </div>
              {#each effects as r (r.label)}
                <div class="kv" use:hoverCard={() => infoCard(r.title, [{ text: `${r.label} ${r.text}`, ok: true }, ...r.lines])}><span class="k">{r.label}</span><span class="v mono" class:neg={r.danger}>{r.text}</span></div>
              {/each}
              {#if effects.length === 0}<div class="empty">보유 유닛 없음</div>{/if}
            </CategoryPanel>
          {:else if p.kind === 'nav'}
            <CategoryPanel id={p.id} title={p.title} count={p.entries?.length ?? 0}>
              {#each p.entries ?? [] as e (e.id)}
                <NavRow entry={e} />
              {/each}
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
                <div class="kv item">
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
  .kv.gb .gbsel {
    flex: 1; min-width: 0; height: 16px; font-size: 10px; padding: 0 2px;
    color: var(--c-text); background: var(--c-bg-input); border: 1px solid var(--c-border-strong); border-radius: var(--r-1);
  }
  /* 아이템 행: 유닛 행과 같은 글자 크기 (이름 9px, 요약 8px) */
  .kv.item { font-size: 9px; color: var(--c-row-text); }
  .kv.item .k { color: var(--c-row-text); }
  .kv.item .note { font-size: 8px; color: var(--c-row-text-2); }
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

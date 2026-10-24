// 발동이감(시간제 이동속도 감소)을 "기대 이감 %" 로 환산한다.
// 스킬마다 가동률 = 1 − exp(−발동 빈도 × 지속) (겹치면 긴 쪽만 남는 것을 반영), 기대 이감 = 수치 × 가동률.
// 같은 group 의 스킬은 서로 중첩되지 않으므로 발동 빈도를 합쳐 가동률 하나로 본다.
// 단일 대상 스킬은 라인 전체에 걸리지 않으므로 합계에서 빼고 참고로만 돌려준다.
// 표: data/proc-slow.json. 공속·회복은 armor-break.ts 와 같은 입력(upgrades.json, 업그레이드 레벨, 버프 합계).
import procJson from '../../data/proc-slow.json';
import upJson from '../../data/upgrades.json';
import { speedInfo, GREEN_BLOOD_SPEED, type OwnedUnit } from '$lib/armor-break';
import type { UpgradeState } from '$lib/stores/upgrade.svelte';

type Trigger =
  | { kind: 'attack'; chance: number }
  | { kind: 'every' }
  | { kind: 'period'; seconds: number }
  | { kind: 'mana'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'hp'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'skip' };

interface ProcSkill {
  name: string;
  trigger: Trigger;
  duration: number;
  value: number;
  single?: boolean;
  group?: string;
  note?: string;
}
interface ProcUnit {
  name: string;
  skills: ProcSkill[];
}
interface UnitUp {
  regenMana: number;
  regenHP: number;
}

export const PROC_SLOW_UNITS: Readonly<Record<string, ProcUnit>> = (procJson as { units: Record<string, ProcUnit> }).units;
const UNIT_UP = (upJson as { units: Record<string, UnitUp> }).units;

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/[.]$/, ''));

export interface ProcSlowLine {
  name: string;
  value: number;
  /** 가동률 0~1 */
  uptime: number;
  /** 기대 이감 % (value × uptime) */
  expected: number;
  how: string;
  single?: boolean;
  note?: string;
}

export interface UnitProcSlow {
  id: string;
  name: string;
  count: number;
  attacksPerSec: number;
  lines: ProcSlowLine[];
  /** 수량 반영 범위 기대 이감 % (라인 이속에 더하는 값) */
  expected: number;
  /** 수량 반영 단일 기대 이감 % (참고) */
  expectedSingle: number;
}

export interface ProcSlowReport {
  /** 전체 범위 기대 이감 % */
  expected: number;
  expectedSingle: number;
  units: UnitProcSlow[];
}

/** 발동 빈도 (초당 발동 횟수). skip 은 null */
function eventsOf(t: Trigger, aps: number, manaBuff: number, base: UnitUp | undefined): { events: number; how: string } | null {
  if (t.kind === 'attack') return { events: aps * (t.chance / 100), how: `공격 ${fmt(aps)}회/초 × ${t.chance}%` };
  if (t.kind === 'every') return { events: aps, how: `매 공격 ${fmt(aps)}회/초` };
  if (t.kind === 'period') return { events: 1 / t.seconds, how: `${t.seconds}초마다` };
  if (t.kind === 'mana' || t.kind === 'hp') {
    const isMana = t.kind === 'mana';
    const own = t.regen ?? (isMana ? (base?.regenMana ?? 0) : (base?.regenHP ?? 0));
    const gain = own + (isMana ? manaBuff : 0) + (t.perAttack ?? 0) * aps;
    return { events: gain > 0 ? gain / t.cost : 0, how: `${isMana ? '마나' : '체력'} ${t.cost} ÷ 초당 ${fmt(gain)}${gain > 0 ? ` = ${fmt(t.cost / gain)}초마다` : ' (회복 없음)'}` };
  }
  return null;
}

export function procSlowReport(owned: OwnedUnit[], speedBuff: number, manaBuff: number, up: UpgradeState): ProcSlowReport {
  const units: UnitProcSlow[] = [];
  for (const o of owned) {
    const u = PROC_SLOW_UNITS[o.id];
    if (!u || o.count <= 0) continue;
    const speed = speedInfo(o.id, o.grade, speedBuff, up, o.greenBlood ? GREEN_BLOOD_SPEED : 0);
    const aps = speed.attacksPerSec;
    const base = UNIT_UP[o.id];
    // group 별로 발동 빈도×지속을 합쳐 가동률 하나를 만든다 (같은 그룹은 중첩 불가)
    const groups = new Map<string, { lam: number; value: number; names: string[]; hows: string[]; single: boolean; note?: string }>();
    const lines: ProcSlowLine[] = [];
    for (const s of u.skills) {
      const ev = eventsOf(s.trigger, aps, manaBuff, base);
      if (!ev) {
        lines.push({ name: s.name, value: s.value, uptime: 0, expected: 0, how: '미계산', single: s.single, note: s.note });
        continue;
      }
      const key = s.group ?? `${s.name}#${s.value}#${s.duration}#${s.single ? 1 : 0}`;
      const g = groups.get(key) ?? { lam: 0, value: 0, names: [], hows: [], single: !!s.single, note: s.note };
      g.lam += ev.events * s.duration;
      g.value = Math.max(g.value, s.value);
      if (!g.names.includes(s.name)) g.names.push(s.name);
      g.hows.push(`${ev.how} × ${s.duration}초`);
      groups.set(key, g);
    }
    let expected = 0;
    let expectedSingle = 0;
    for (const g of groups.values()) {
      const uptime = 1 - Math.exp(-g.lam);
      const exp = g.value * uptime;
      if (g.single) expectedSingle += exp;
      else expected += exp;
      lines.push({ name: g.names.join('+'), value: g.value, uptime, expected: exp, how: g.hows.join(' + '), single: g.single, note: g.note });
    }
    lines.sort((a, b) => b.expected - a.expected);
    units.push({ id: o.id, name: u.name + (o.greenBlood ? ' (그린블러드)' : ''), count: o.count, attacksPerSec: aps, lines, expected: expected * o.count, expectedSingle: expectedSingle * o.count });
  }
  units.sort((a, b) => b.expected - a.expected);
  return { expected: units.reduce((a, x) => a + x.expected, 0), expectedSingle: units.reduce((a, x) => a + x.expectedSingle, 0), units };
}

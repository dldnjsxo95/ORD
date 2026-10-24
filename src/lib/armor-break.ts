// 아머브레이크(AB)를 "초당 깍 수치"로 환산한다.
// AB 1스택 = 적 방어력 1 감소(최대 75). 스킬 발동 빈도 × 발동당 스택을 기대값으로 더한다.
// 입력: 보유 유닛 수량, 현재 능력치의 공속·마젠 합계, 업그레이드 레벨(stores/upgrade).
// 표: data/armor-break.json (스킬 발동 조건, 툴팁에서 손으로 정리) + data/upgrades.json (맵 추출: 공속 업그레이드·쿨타임·회복).
import abJson from '../../data/armor-break.json';
import upJson from '../../data/upgrades.json';
import type { UpgradeState } from '$lib/stores/upgrade.svelte';

type Trigger =
  | { kind: 'attack'; chance: number }
  | { kind: 'mana'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'hp'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'buff'; chance: number; duration: number }
  | { kind: 'skip' };

interface AbSkill {
  name: string;
  trigger: Trigger;
  stacks: number;
  single?: boolean;
  note?: string;
}
interface AbUnit {
  name: string;
  skills: AbSkill[];
}
interface UpgradeDef {
  name: string;
  max: number;
  /** 레벨 1 공속 보너스 (%) */
  base: number;
  /** 레벨당 증가 (%) */
  inc: number;
}
interface UnitUp {
  upgrade: string | null;
  cooldown: number | null;
  regenMana: number;
  regenHP: number;
  mana: number;
  hp: number;
}

export const AB_UNITS: Readonly<Record<string, AbUnit>> = (abJson as { units: Record<string, AbUnit> }).units;
const UPGRADES = (upJson as { upgrades: Record<string, UpgradeDef> }).upgrades;
const UNIT_UP = (upJson as { units: Record<string, UnitUp> }).units;
export const AB_MAX = 75;

/** 유닛의 공속 업그레이드 정의 (없으면 null) */
export function upgradeOf(id: string): UpgradeDef | null {
  const u = UNIT_UP[id];
  return u?.upgrade ? (UPGRADES[u.upgrade] ?? null) : null;
}

/** 레벨 n 의 업그레이드 공속 보너스 (%) : 0 레벨은 0, n≥1 은 base + inc×(n−1) */
export function upgradeBonus(def: UpgradeDef | null, level: number): number {
  if (!def || level <= 0) return 0;
  const n = Math.min(level, def.max);
  return def.base + def.inc * (n - 1);
}

export interface SpeedInfo {
  /** 업그레이드 보너스 (%) */
  fromUpgrade: number;
  /** 버프 (%) — 현재 능력치 공속 합계 */
  fromBuff: number;
  /** 상한 적용 전 합계 (%) */
  raw: number;
  /** 상한 적용 후 (%) */
  total: number;
  capped: boolean;
  /** 풀강 기준, 상한까지 남는 버프 여유 (%) — 0 이하면 버프 없이도 상한 */
  headroomAtMax: number;
  /** 풀강 업그레이드 보너스 (%) */
  atMax: number;
  upgradeName: string | null;
  /** 신비 최종 공속 +25% 적용 여부 */
  mystic: boolean;
  cooldown: number;
  attacksPerSec: number;
}

const MYSTIC = /신비/;

/** 그린블러드(기록지침): 부여한 유닛 1기의 공격속도 +30% */
export const GREEN_BLOOD_SPEED = 30;

export function speedInfo(id: string, grade: string | null | undefined, speedBuff: number, up: UpgradeState, extraSpeed = 0): SpeedInfo {
  const def = upgradeOf(id);
  const cooldown = UNIT_UP[id]?.cooldown ?? 1;
  const fromUpgrade = upgradeBonus(def, up.level);
  const raw = fromUpgrade + speedBuff + extraSpeed;
  const total = Math.min(raw, up.speedCap);
  const atMax = upgradeBonus(def, def?.max ?? 0);
  const mystic = up.mysticBonus && MYSTIC.test(grade ?? '');
  const cd = cooldown > 0 ? cooldown : 1;
  return {
    fromUpgrade, fromBuff: speedBuff + extraSpeed, raw, total, capped: raw > up.speedCap, headroomAtMax: up.speedCap - atMax, atMax,
    upgradeName: def?.name ?? null, mystic, cooldown: cd,
    attacksPerSec: ((1 + total / 100) / cd) * (mystic ? 1.25 : 1),
  };
}

export interface SkillRate {
  name: string;
  /** 초당 AB 기대값 (유닛 1기) */
  perSec: number;
  /** 사람이 읽는 계산 근거 */
  how: string;
  single?: boolean;
  note?: string;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/[.]$/, ''));

/** 유닛 1기의 스킬별 초당 AB */
export function skillRates(id: string, aps: number, manaBuff: number): SkillRate[] {
  const u = AB_UNITS[id];
  if (!u) return [];
  const base = UNIT_UP[id];
  return u.skills.map((s) => {
    const t = s.trigger;
    if (t.kind === 'attack') {
      const perSec = aps * (t.chance / 100) * s.stacks;
      return { name: s.name, perSec, how: `공격 ${fmt(aps)}회/초 × ${t.chance}% × ${s.stacks}`, single: s.single, note: s.note };
    }
    if (t.kind === 'buff') {
      // 발동 확률 × 버프 중 평타 수 × 스택 (버프 겹침은 무시)
      const hits = t.duration * aps;
      const perSec = aps * (t.chance / 100) * hits * s.stacks;
      return { name: s.name, perSec, how: `공격 ${fmt(aps)}회/초 × ${t.chance}% × 버프 ${t.duration}초 동안 ${fmt(hits)}타 × ${s.stacks}`, single: s.single, note: s.note };
    }
    if (t.kind === 'mana' || t.kind === 'hp') {
      const isMana = t.kind === 'mana';
      const own = t.regen ?? (isMana ? (base?.regenMana ?? 0) : (base?.regenHP ?? 0));
      const regen = own + (isMana ? manaBuff : 0);
      const gain = regen + (t.perAttack ?? 0) * aps;
      const period = gain > 0 ? t.cost / gain : Infinity;
      const perSec = gain > 0 ? s.stacks / period : 0;
      const res = isMana ? '마나' : '체력';
      const parts = [`회복 ${fmt(own)}`];
      if (isMana && manaBuff) parts.push(`마젠 버프 ${fmt(manaBuff)}`);
      if (t.perAttack) parts.push(`공격당 ${t.perAttack} × ${fmt(aps)}회`);
      const how = `${res} ${t.cost} ÷ 초당 ${fmt(gain)} (${parts.join(' + ')}) = ${Number.isFinite(period) ? fmt(period) + '초' : '∞'}마다 ${s.stacks}`;
      return { name: s.name, perSec, how, single: s.single, note: s.note };
    }
    return { name: s.name, perSec: 0, how: '미계산', single: s.single, note: s.note };
  });
}

export interface UnitAb {
  id: string;
  name: string;
  count: number;
  speed: SpeedInfo;
  skills: SkillRate[];
  /** 유닛 1기 초당 AB */
  each: number;
  /** 수량 반영 초당 AB */
  perSec: number;
}

export interface AbReport {
  perSec: number;
  /** 75까지 걸리는 초 (perSec 0 이면 null) */
  secondsToMax: number | null;
  units: UnitAb[];
}

/** 보유 유닛 항목. greenBlood 가 true 면 그린블러드를 부여한 1기 (count 는 1 이어야 함) */
export interface OwnedUnit {
  id: string;
  name: string;
  grade: string | null | undefined;
  count: number;
  greenBlood?: boolean;
}

export function abReport(owned: OwnedUnit[], speedBuff: number, manaBuff: number, up: UpgradeState): AbReport {
  const units: UnitAb[] = [];
  for (const o of owned) {
    if (!AB_UNITS[o.id] || o.count <= 0) continue;
    const speed = speedInfo(o.id, o.grade, speedBuff, up, o.greenBlood ? GREEN_BLOOD_SPEED : 0);
    const skills = skillRates(o.id, speed.attacksPerSec, manaBuff);
    const each = skills.reduce((a, s) => a + s.perSec, 0);
    units.push({ id: o.id, name: (AB_UNITS[o.id].name || o.name) + (o.greenBlood ? ' (그린블러드)' : ''), count: o.count, speed, skills, each, perSec: each * o.count });
  }
  units.sort((a, b) => b.perSec - a.perSec);
  const perSec = units.reduce((a, u) => a + u.perSec, 0);
  return { perSec, secondsToMax: perSec > 0 ? AB_MAX / perSec : null, units };
}

/** 숫자 표시: 정수면 그대로, 아니면 소수 1~2자리 */
export function fmtAb(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  if (Number.isInteger(v)) return String(v);
  return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '');
}

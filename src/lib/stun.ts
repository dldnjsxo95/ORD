// 스턴 가동률: 적이 스턴에 걸려 있는 시간 비율. 스킬마다 (발동 빈도 × 지속 × 저항 계수)를 더한 뒤
// 겹침을 반영해 1 − exp(−합) 로 환산한다 (발동이 무작위로 흩어진다고 가정한 구간 합집합의 비율).
// 저항: 설정 stunResist(%) 만큼 지속이 줄며, "저항 무시" 스킬은 그대로, "저항 N% 무시"는 N% 만큼 덜 깎인다.
// 표: data/stun.json (툴팁에서 정리). 공속·회복은 armor-break.ts 와 같은 입력(upgrades.json, 업그레이드 레벨, 버프 합계).
import stunJson from '../../data/stun.json';
import upJson from '../../data/upgrades.json';
import { speedInfo, GREEN_BLOOD_SPEED, type SpeedInfo, type OwnedUnit } from '$lib/armor-break';
import type { UpgradeState } from '$lib/stores/upgrade.svelte';

type Trigger =
  | { kind: 'attack'; chance: number }
  | { kind: 'mana'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'hp'; cost: number; regen?: number; perAttack?: number }
  | { kind: 'period'; seconds: number }
  | { kind: 'skip' };

interface StunSkill {
  name: string;
  trigger: Trigger;
  duration: number;
  /** 'ignore' = 저항 무시, 숫자 = 저항 N% 무시, 없으면 저항 전부 적용 */
  resist?: 'ignore' | number;
  single?: boolean;
  note?: string;
}
interface StunUnit {
  name: string;
  skills: StunSkill[];
}
interface UnitUp {
  regenMana: number;
  regenHP: number;
}

export const STUN_UNITS: Readonly<Record<string, StunUnit>> = (stunJson as { units: Record<string, StunUnit> }).units;
const UNIT_UP = (upJson as { units: Record<string, UnitUp> }).units;

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/[.]$/, ''));

/** 저항 계수: 지속 시간에 곱하는 값 (1 = 그대로) */
export function resistFactor(resist: StunSkill['resist'], resistPct: number): number {
  const r = Math.max(0, Math.min(100, resistPct)) / 100;
  if (resist === 'ignore') return 1;
  if (typeof resist === 'number') return 1 - r * (1 - resist / 100);
  return 1 - r;
}

export interface StunSkillRate {
  name: string;
  /** 초당 스턴 초 (유닛 1기, 저항 반영) */
  perSec: number;
  /** 초당 발동 횟수 (유닛 1기) */
  events: number;
  how: string;
  single?: boolean;
  note?: string;
}

/** 그린블러드 진력해방: 3초마다 825범위 1.2초 스턴 (부여한 유닛 1기) */
export const GREEN_BLOOD_STUN: StunSkill = { name: '그린블러드 진력해방', trigger: { kind: 'period', seconds: 3 }, duration: 1.2 };

export function stunSkillRates(id: string, aps: number, manaBuff: number, up: UpgradeState, extra: StunSkill[] = []): StunSkillRate[] {
  const u = STUN_UNITS[id];
  const base = UNIT_UP[id];
  return [...(u?.skills ?? []), ...extra].map((s) => {
    const t = s.trigger;
    const f = resistFactor(s.resist, up.stunResist);
    const eff = s.duration * f;
    const dur = `${s.duration}초${f < 1 ? `→${fmt(eff)}초` : s.resist === 'ignore' ? ' (저항 무시)' : ''}`;
    let events = 0;
    let how = '';
    if (t.kind === 'attack') {
      events = aps * (t.chance / 100);
      how = `공격 ${fmt(aps)}회/초 × ${t.chance}% × ${dur}`;
    } else if (t.kind === 'period') {
      events = 1 / t.seconds;
      how = `${t.seconds}초마다 × ${dur}`;
    } else if (t.kind === 'mana' || t.kind === 'hp') {
      const isMana = t.kind === 'mana';
      const own = t.regen ?? (isMana ? (base?.regenMana ?? 0) : (base?.regenHP ?? 0));
      const gain = own + (isMana ? manaBuff : 0) + (t.perAttack ?? 0) * aps;
      events = gain > 0 ? gain / t.cost : 0;
      how = `${isMana ? '마나' : '체력'} ${t.cost} ÷ 초당 ${fmt(gain)} = ${gain > 0 ? fmt(t.cost / gain) + '초마다' : '회복 없음'} × ${dur}`;
    } else {
      how = '미계산';
    }
    return { name: s.name, perSec: events * eff, events, how, single: s.single, note: s.note };
  });
}

export interface UnitStun {
  id: string;
  name: string;
  count: number;
  speed: SpeedInfo;
  skills: StunSkillRate[];
  /** 유닛 1기 초당 범위 스턴 초 */
  each: number;
  /** 수량 반영 초당 범위 스턴 초 (정지율에 들어가는 값) */
  lambda: number;
  /** 수량 반영 초당 단일 스턴 초 (참고용, 정지율 미반영) */
  lambdaSingle: number;
  /** 수량 반영 초당 범위 스턴 발동 횟수 */
  events: number;
  /** 이 유닛(수량 포함)만 있을 때 범위 스턴 가동률 0~1 */
  alone: number;
}

export interface StunReport {
  /** 전체 초당 범위 스턴 초 (겹침 전) */
  lambda: number;
  /** 전체 초당 단일 스턴 초 (참고용) */
  lambdaSingle: number;
  /** 전체 초당 범위 스턴 발동 횟수 */
  events: number;
  /** 범위 스턴 가동률 0~1 */
  uptime: number;
  units: UnitStun[];
}

export const uptimeOf = (lambda: number) => 1 - Math.exp(-lambda);

/**
 * 단일 스턴은 한 번에 한 기만 멈추므로 라인 전체에는 효과가 없다고 보고 정지율에서 뺀다 (사용자 결정 2026-10-24).
 * 범위 스턴만 λ 에 넣고, 단일은 lambdaSingle 로 따로 돌려준다.
 */
export function stunReport(owned: OwnedUnit[], speedBuff: number, manaBuff: number, up: UpgradeState): StunReport {
  const units: UnitStun[] = [];
  for (const o of owned) {
    if ((!STUN_UNITS[o.id] && !o.greenBlood) || o.count <= 0) continue;
    const speed = speedInfo(o.id, o.grade, speedBuff, up, o.greenBlood ? GREEN_BLOOD_SPEED : 0);
    const skills = stunSkillRates(o.id, speed.attacksPerSec, manaBuff, up, o.greenBlood ? [GREEN_BLOOD_STUN] : []);
    const aoe = skills.filter((s) => !s.single);
    const each = aoe.reduce((a, s) => a + s.perSec, 0);
    const lambda = each * o.count;
    const lambdaSingle = skills.filter((s) => s.single).reduce((a, s) => a + s.perSec, 0) * o.count;
    const events = aoe.reduce((a, s) => a + s.events, 0) * o.count;
    units.push({ id: o.id, name: (STUN_UNITS[o.id]?.name || o.name) + (o.greenBlood ? ' (그린블러드)' : ''), count: o.count, speed, skills, each, lambda, lambdaSingle, events, alone: uptimeOf(lambda) });
  }
  units.sort((a, b) => b.lambda - a.lambda);
  const lambda = units.reduce((a, u) => a + u.lambda, 0);
  const lambdaSingle = units.reduce((a, u) => a + u.lambdaSingle, 0);
  const events = units.reduce((a, u) => a + u.events, 0);
  return { lambda, lambdaSingle, events, uptime: uptimeOf(lambda), units };
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

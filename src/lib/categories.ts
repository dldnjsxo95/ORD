// 메인 화면의 분류 격자. 사용자 지정 순서 (2026-10-23).
import type { Unit } from '$lib/api';

export interface Category {
  id: string;
  title: string;
  /** 등급 일치 조건 */
  grade?: string;
  /** 물딜/마딜 조건 (등급을 둘로 나눌 때) */
  dmg?: '물딜' | '마딜';
  /** 스턴 유닛 모음 */
  stun?: boolean;
  /** 위 조건으로 안 잡힌 나머지 (임시) */
  rest?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'common', title: '흔함', grade: '흔함' },
  { id: 'uncommon', title: '안흔함', grade: '안흔함' },
  { id: 'special', title: '특별', grade: '특별' },
  { id: 'rare', title: '희귀함', grade: '희귀' },
  { id: 'legend-p', title: '전설 물딜', grade: '전설', dmg: '물딜' },
  { id: 'legend-m', title: '전설 마딜', grade: '전설', dmg: '마딜' },
  { id: 'stun', title: '스턴', stun: true },
  { id: 'distort', title: '왜곡', grade: '왜곡' },
  { id: 'tr-p', title: '초월 물딜', grade: '초월', dmg: '물딜' },
  { id: 'tr-m', title: '초월 마딜', grade: '초월', dmg: '마딜' },
  { id: 'im-p', title: '불멸 물딜', grade: '불멸', dmg: '물딜' },
  { id: 'im-m', title: '불멸 마딜', grade: '불멸', dmg: '마딜' },
  { id: 'et-p', title: '영원 물딜', grade: '영원', dmg: '물딜' },
  { id: 'et-m', title: '영원 마딜', grade: '영원', dmg: '마딜' },
  { id: 'lim-p', title: '제한 물딜', grade: '제한', dmg: '물딜' },
  { id: 'lim-m', title: '제한 마딜', grade: '제한', dmg: '마딜' },
  { id: 'mys-p', title: '신비 물딜', grade: '신비', dmg: '물딜' },
  { id: 'mys-m', title: '신비 마딜', grade: '신비', dmg: '마딜' },
  // 임시: 사용자 분류에 없는 등급과 물딜/마딜 미분류. 확정되면 정리한다.
  { id: 'rest', title: '미분류 · 기타', rest: true },
];

/** 격자에 올리는 유닛: 분신·스킨 변형·등급 없음 제외 */
export function isGridUnit(u: Unit): boolean {
  return !!u.grade && !u.summon && !u.baseForm;
}

export function categorize(units: Unit[]): Map<string, Unit[]> {
  const out = new Map<string, Unit[]>(CATEGORIES.map((c) => [c.id, []]));
  for (const u of units) {
    if (!isGridUnit(u)) continue;
    let placed = false;
    for (const c of CATEGORIES) {
      if (c.rest) continue;
      if (c.stun) {
        if (u.stun) { out.get(c.id)!.push(u); placed = true; }
        continue;
      }
      if (c.grade !== u.grade) continue;
      if (c.dmg && c.dmg !== u.damageType) continue;
      out.get(c.id)!.push(u);
      placed = true;
    }
    if (!placed) out.get('rest')!.push(u);
  }
  return out;
}

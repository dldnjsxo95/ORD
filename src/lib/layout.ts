// 메인 화면 배치: 능력치 필터 목록과 8열 패널 구성 (사용자 사양 2026-10-23).
import type { Unit } from '$lib/api';

/** 능력치 필터 라벨. 추출기의 TAG_RULES 라벨과 같아야 한다. */
export const FILTERS = [
  '방어력 감소', '이동속도 감소', '발동이동속도 감소', '공격속도 증가(단일)', '공격력 증가', '스턴', '공격속도 증가',
  '마나 재생', '아머브레이크', '보조딜', '바제스', '발동방어력 감소', '발동공격력 증가', '광폭화 잡기', '단일방어력 감소',
  '단일마법 대미지 증가', '모든피해증가', '방어력 무시 대미지', '유닛삭제', '마법 대미지 증가', '범위 전체 체력 퍼센트 대미지',
  '보스 잡기', '단일', '범위 현재 체력 퍼센트 대미지', '끝딜', '마법 방어력 감소', '체력 재생', '폭발형 대미지 증폭',
  '범위 잃은 체력 퍼센트 대미지', '단일아머브레이크', '중첩방어력 감소', '순간이동', '범위 퍼센트 대미지', '범위 끝딜',
];

export type Bucket = '물딜' | '마딜' | '스턴';
export type PanelKind = 'units' | 'stats' | 'resources' | 'items';

export interface PanelDef {
  id: string;
  title: string;
  kind: PanelKind;
  /** 등급 (units 패널) */
  grade?: string;
  /** 같은 등급을 물딜/마딜/스턴으로 나눌 때 */
  bucket?: Bucket;
  /** 등급 대신 특정 유닛 id 목록 */
  ids?: string[];
  /** 어디에도 안 들어간 나머지 (기타) */
  rest?: boolean;
}

export const COLUMNS: PanelDef[][] = [
  [
    { id: 'stats', title: '현재 능력치', kind: 'stats' },
    { id: 'common', title: '흔함', kind: 'units', grade: '흔함' },
    { id: 'uncommon', title: '안흔함', kind: 'units', grade: '안흔함' },
    { id: 'rest', title: '기타', kind: 'units', rest: true },
  ],
  [
    { id: 'special', title: '특별함', kind: 'units', grade: '특별' },
    { id: 'resources', title: '재화', kind: 'resources' },
  ],
  [{ id: 'rare', title: '희귀함', kind: 'units', grade: '희귀' }],
  [
    { id: 'legend-p', title: '전설[물딜]', kind: 'units', grade: '전설', bucket: '물딜' },
    { id: 'legend-m', title: '전설[마딜]', kind: 'units', grade: '전설', bucket: '마딜' },
    { id: 'legend-s', title: '전설[스턴]', kind: 'units', grade: '전설', bucket: '스턴' },
  ],
  [
    { id: 'ship', title: '해적선', kind: 'units', ids: ['h060', 'h06G'] },
    { id: 'hidden-p', title: '히든[물딜]', kind: 'units', grade: '히든', bucket: '물딜' },
    { id: 'hidden-m', title: '히든[마딜]', kind: 'units', grade: '히든', bucket: '마딜' },
    { id: 'hidden-s', title: '히든[스턴]', kind: 'units', grade: '히든', bucket: '스턴' },
    { id: 'distort', title: '왜곡됨', kind: 'units', grade: '왜곡' },
    { id: 'changed', title: '변화됨', kind: 'units', grade: '변화' },
  ],
  [
    { id: 'tr-p', title: '초월[물딜]', kind: 'units', grade: '초월', bucket: '물딜' },
    { id: 'tr-m', title: '초월[마딜]', kind: 'units', grade: '초월', bucket: '마딜' },
    { id: 'special2', title: '특수함', kind: 'units', grade: '특수' },
  ],
  [
    { id: 'lim-p', title: '제한됨[물딜]', kind: 'units', grade: '제한', bucket: '물딜' },
    { id: 'lim-m', title: '제한됨[마딜]', kind: 'units', grade: '제한', bucket: '마딜' },
    { id: 'im-p', title: '불멸[물딜]', kind: 'units', grade: '불멸', bucket: '물딜' },
    { id: 'im-m', title: '불멸[마딜]', kind: 'units', grade: '불멸', bucket: '마딜' },
    { id: 'et-p', title: '영원[물딜]', kind: 'units', grade: '영원', bucket: '물딜' },
    { id: 'et-m', title: '영원[마딜]', kind: 'units', grade: '영원', bucket: '마딜' },
  ],
  [
    { id: 'random', title: '랜덤', kind: 'units', grade: '랜덤전용' },
    { id: 'seraphim', title: '세라핌', kind: 'units', grade: '세라핌' },
    { id: 'mys-p', title: '신비함[물딜]', kind: 'units', grade: '신비', bucket: '물딜' },
    { id: 'mys-m', title: '신비함[마딜]', kind: 'units', grade: '신비', bucket: '마딜' },
    { id: 'items', title: '아이템', kind: 'items' },
  ],
];

export const ALL_PANELS: PanelDef[] = COLUMNS.flat();

/** 격자에 올리는 유닛: 분신·스킨 변형 제외 */
export function isGridUnit(u: Unit): boolean {
  return !u.summon && !u.baseForm;
}

/** 유닛이 들어갈 버킷. 스턴 버킷이 있는 등급에서 stun 이면 스턴, 아니면 물딜/마딜(미분류는 마딜, uncertain=true). */
function bucketOf(u: Unit, hasStun: boolean): { bucket: Bucket; uncertain: boolean } {
  if (hasStun && u.stun) return { bucket: '스턴', uncertain: false };
  if (u.damageType === '물딜' || u.damageType === '마딜') return { bucket: u.damageType, uncertain: false };
  return { bucket: '마딜', uncertain: true };
}

export interface Placed {
  unit: Unit;
  /** 물딜/마딜 판정이 없어 임시로 넣은 경우 */
  uncertain: boolean;
}

export function placeUnits(units: Unit[]): Map<string, Placed[]> {
  const out = new Map<string, Placed[]>(ALL_PANELS.map((p) => [p.id, []]));
  const byIds = ALL_PANELS.filter((p) => p.ids);
  const stunGrades = new Set(ALL_PANELS.filter((p) => p.bucket === '스턴').map((p) => p.grade));
  for (const u of units) {
    if (!isGridUnit(u)) continue;
    const idPanel = byIds.find((p) => p.ids!.includes(u.id));
    if (idPanel) { out.get(idPanel.id)!.push({ unit: u, uncertain: false }); continue; }
    if (!u.grade) continue;
    const candidates = ALL_PANELS.filter((p) => p.kind === 'units' && p.grade === u.grade);
    if (candidates.length === 0) { out.get('rest')!.push({ unit: u, uncertain: false }); continue; }
    if (candidates.length === 1 && !candidates[0].bucket) { out.get(candidates[0].id)!.push({ unit: u, uncertain: false }); continue; }
    const { bucket, uncertain } = bucketOf(u, stunGrades.has(u.grade));
    const target = candidates.find((p) => p.bucket === bucket) ?? candidates[0];
    out.get(target.id)!.push({ unit: u, uncertain });
  }
  return out;
}

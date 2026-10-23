// 메인 화면 배치: 능력치 필터 목록과 8열 패널 구성. 패널과 항목은 data/layout.json (사용자 사양) 에서 읽는다.
import layoutJson from '../../data/layout.json';

/** 능력치 필터 라벨. 유닛이 어느 라벨에 해당하는지는 괄호 요약으로 정한다 (traits.ts). */
export const FILTERS = [
  '방어력 감소', '이동속도 감소', '발동이동속도 감소', '공격속도 증가(단일)', '공격력 증가', '스턴', '공격속도 증가',
  '마나 재생', '아머브레이크', '보조딜', '바제스', '발동방어력 감소', '발동공격력 증가', '광폭화 잡기', '단일방어력 감소',
  '단일마법 대미지 증가', '모든피해증가', '방어력 무시 대미지', '유닛삭제', '마법 대미지 증가', '범위 전체 체력 퍼센트 대미지',
  '보스 잡기', '단일', '범위 현재 체력 퍼센트 대미지', '끝딜', '마법 방어력 감소', '체력 재생', '폭발형 대미지 증폭',
  '범위 잃은 체력 퍼센트 대미지', '단일아머브레이크', '중첩방어력 감소', '순간이동', '범위 퍼센트 대미지', '범위 끝딜',
];

export type PanelKind = 'units' | 'stats' | 'resources' | 'items';

export interface Entry {
  /** 유닛 rawcode 또는 아이템 id (AI00 등) */
  id?: string;
  /** 표시 이름 (사용자 표기) */
  label?: string;
  /** 괄호 안 요약 */
  note?: string;
  /** 유닛이 아닌 안내 행 */
  text?: string;
  /** 데이터에서 찾지 못한 항목 */
  unresolved?: boolean;
  /** 역할 배지: flag | sword | heart-blue | heart-red | heart-white | plus (사양서 표기) */
  badges?: string[];
  /** 티어 표기: F, D, C, B, A, A+, S */
  tier?: string;
}

export interface PanelDef {
  id: string;
  title: string;
  kind: PanelKind;
  entries?: Entry[];
}

export const COLUMNS: PanelDef[][] = (layoutJson as { columns: PanelDef[][] }).columns;
export const ALL_PANELS: PanelDef[] = COLUMNS.flat();

/** 유닛 id → 사양서 항목 + 속한 패널 제목 (예: "불멸 [마딜]"). 여러 행에 있으면 먼저 나온 것. */
export const ENTRY_BY_ID: ReadonlyMap<string, Entry & { panel: string }> = (() => {
  const m = new Map<string, Entry & { panel: string }>();
  for (const p of ALL_PANELS) for (const e of p.entries ?? []) if (e.id && !m.has(e.id)) m.set(e.id, { ...e, panel: p.title });
  return m;
})();

// 유닛 특징의 유일한 출처: 사양서에서 유닛 이름 옆 괄호 안에 적힌 요약 (data/layout.json 의 note).
// 추출기가 스킬 설명에서 추정한 태그(Unit.tags)는 화면 어디에도 쓰지 않는다 (사용자 결정 2026-10-23).
// 능력치 필터와 "현재 능력치" 집계는 여기서 괄호 요약 토큰을 필터 라벨로 바꾼 결과를 쓴다.
import { ALL_PANELS } from '$lib/layout';

/** 유닛 id → 괄호 요약. 같은 유닛이 여러 행에 있으면 먼저 나온 요약을 쓴다. */
export const NOTE_BY_ID: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const p of ALL_PANELS) for (const e of p.entries ?? []) if (e.id && e.note && !m.has(e.id)) m.set(e.id, e.note);
  return m;
})();

/** 토큰 패턴 → 필터 라벨 (여러 개면 전부). 숫자는 라벨 판정에 쓰지 않는다. */
const RULES: Array<[RegExp, string[]]> = [
  [/체마젠\+공증/, ['체력 재생', '마나 재생', '공격력 증가']],
  [/^발동(?:방)?깍/, ['발동방어력 감소']],
  [/^단일깍/, ['단일방어력 감소']],
  [/^중첩깍/, ['중첩방어력 감소']],
  [/^마방깍/, ['마법 방어력 감소']],
  [/^(?:조건|방)?깍/, ['방어력 감소']],
  [/^발(?:동)?이감/, ['발동이동속도 감소']],
  [/^이감/, ['이동속도 감소']],
  [/^발동공증/, ['발동공격력 증가']],
  [/공증/, ['공격력 증가']],
  [/^공속/, ['공격속도 증가']],
  [/^단일암브/, ['단일아머브레이크']],
  [/^암브/, ['아머브레이크']],
  [/^(?:\d+(?:\.\d+)?)?스턴|^\d+(?:\.\d+)?스$|^단일스턴/, ['스턴']],
  [/마(?:나)?젠/, ['마나 재생']],
  [/체젠/, ['체력 재생']],
  [/체마(?:젠)?/, ['체력 재생', '마나 재생']],
  [/^폭뎀증/, ['폭발형 대미지 증폭']],
  [/^마뎀단일/, ['단일마법 대미지 증가']],
  [/^마(?:뎀)?증/, ['마법 대미지 증가']],
  [/^(?:뎀증|피증)/, ['모든피해증가']],
  [/^범현퍼/, ['범위 현재 체력 퍼센트 대미지']],
  [/^범잃퍼/, ['범위 잃은 체력 퍼센트 대미지']],
  [/^(?:범)?전퍼/, ['범위 전체 체력 퍼센트 대미지']],
  [/^광보잡/, ['광폭화 잡기', '보스 잡기']],
  [/^광잡/, ['광폭화 잡기']],
  [/^보잡/, ['보스 잡기']],
  [/^범위끝딜/, ['범위 끝딜']],
  [/^(?:마뎀)?끝딜/, ['끝딜']],
  [/^블링크/, ['순간이동']],
  [/삭제/, ['유닛삭제']],
  [/^보조딜/, ['보조딜']],
  [/^바제스/, ['바제스']],
  [/^단일/, ['단일']],
];

/** 괄호 요약 한 토큰 → 필터 라벨들 (없으면 빈 배열) */
export function labelsOfToken(tok: string): string[] {
  const t = tok.trim();
  if (!t) return [];
  for (const [re, labels] of RULES) if (re.test(t)) return labels;
  return [];
}

/** 괄호 요약 전체 → 필터 라벨 (중복 제거, 순서 유지) */
export function labelsOfNote(note: string | undefined): string[] {
  if (!note) return [];
  const out: string[] = [];
  for (const tok of note.split(/[,/]/)) for (const l of labelsOfToken(tok)) if (!out.includes(l)) out.push(l);
  return out;
}

const cache = new Map<string, string[]>();
/** 유닛의 특징 라벨. 괄호 요약이 없는 유닛(흔함·안흔함 등)은 빈 배열. */
export function traitsOf(unitId: string): string[] {
  let v = cache.get(unitId);
  if (!v) cache.set(unitId, (v = labelsOfNote(NOTE_BY_ID.get(unitId))));
  return v;
}

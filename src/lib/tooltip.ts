// 호버 카드 내용 생성: 조합식(재료·비용·조건) → 구분선 → 특징(요약 약어를 풀어 씀).
import type { Recipe, Unit, Condition, ComboStatus } from '$lib/api';

/** 약어 → 읽기 쉬운 표현. 숫자가 붙는 것은 "라벨 : 값" 꼴로 만든다. */
const NUMERIC: Array<[RegExp, string, string]> = [
  // [패턴, 라벨, 단위]
  [/^발동깍(-?\d+(?:\.\d+)?)$/, '발동 방어력 감소', ''],
  [/^단일깍(-?\d+(?:\.\d+)?)$/, '단일 방어력 감소', ''],
  [/^조건깍(-?\d+(?:\.\d+)?)$/, '조건부 방어력 감소', ''],
  [/^중첩깍(-?\d+(?:\.\d+)?)?$/, '중첩 방어력 감소', ''],
  [/^마방깍(-?\d+(?:\.\d+)?)$/, '마법 방어력 감소', ''],
  [/^(?:방)?깍(-?\d+(?:\.\d+)?)$/, '방어력 감소', ''],
  [/^발동이감(-?\d+(?:\.\d+)?)?$/, '발동 이동속도 감소', '%'],
  [/^발이감(-?\d+(?:\.\d+)?)?$/, '발동 이동속도 감소', '%'],
  [/^이감(-?\d+(?:\.\d+)?)$/, '이동속도 감소', '%'],
  [/^발동공증(-?\d+(?:\.\d+)?)$/, '발동 공격력 증가', '%'],
  [/^단일공증(-?\d+(?:\.\d+)?)$/, '단일 공격력 증가', '%'],
  [/^공증(-?\d+(?:\.\d+)?)$/, '공격력 증가', '%'],
  [/^공속(?:증가|증)?(-?\d+(?:\.\d+)?)$/, '공격속도 증가', '%'],
  [/^(\d+(?:\.\d+)?)스턴$/, '스턴', '초'],
  [/^스턴(\d+(?:\.\d+)?)$/, '스턴', '초'],
  [/^(\d+(?:\.\d+)?)스$/, '스턴', '초'],
  [/^마(?:나)?젠(\d+(?:\.\d+)?)$/, '마나 재생', ''],
  [/^체젠(\d+(?:\.\d+)?)$/, '체력 재생', ''],
  [/^단일체젠(\d+(?:\.\d+)?)$/, '단일 체력 재생', ''],
  [/^체마젠(\d+(?:\.\d+)?)?$/, '체력·마나 재생', ''],
  [/^체마(\d+(?:\.\d+)?)?$/, '체력·마나 재생', ''],
  [/^폭뎀증(\d+(?:\.\d+)?)?$/, '폭발형 대미지 증폭', ''],
  [/^마뎀증(\d+(?:\.\d+)?)?$/, '마법 대미지 증가', ''],
  [/^뎀증(\d+(?:\.\d+)?)$/, '대미지 증가', ''],
  [/^피증(\d+(?:\.\d+)?)$/, '피해 증가', ''],
  [/^마증(\d+(?:\.\d+)?)?$/, '마법 대미지 증가', ''],
  [/^단일(\d+(?:\.\d+)?)$/, '단일 대상 퍼센트 대미지', ''],
  [/^마뎀단일(\d+(?:\.\d+)?)?$/, '마법 단일 대상 대미지', ''],
  [/^범현퍼(\d+(?:\.\d+)?)?$/, '범위 현재 체력 퍼센트 대미지', ''],
  [/^범잃퍼(\d+(?:\.\d+)?)?$/, '범위 잃은 체력 퍼센트 대미지', ''],
  [/^범전퍼(\d+(?:\.\d+)?)?$/, '범위 전체 체력 퍼센트 대미지', ''],
  [/^전퍼(\d+(?:\.\d+)?)?$/, '전체 체력 퍼센트 대미지', ''],
  [/^암브(\d+(?:\.\d+)?)?$/, '아머브레이크', ''],
  [/^단일암브(\d+(?:\.\d+)?)?$/, '단일 아머브레이크', ''],
];
const WORDS: Record<string, string> = {
  광보잡: '광폭화·보스 잡기', 광잡: '광폭화 잡기', 보잡: '보스 잡기', 끝딜: '끝딜', 단일: '단일', 블링크: '순간이동', 삭제: '유닛 삭제',
  공폭뎀: '공격력 비례 폭발 대미지', 라인딜: '라인 딜', 가속: '가속', 스플: '스플래시', 스플딜: '스플래시 딜', 물마가능: '물딜·마딜 모두 가능',
  '1시가능': '1시 가능', 보조딜: '보조딜', 탐색: '탐색', 처형: '처형', 흡수: '흡수', 넉백: '넉백', 강화: '강화', 복제: '복제', 점치기: '점치기',
  w자석: 'W 자석', 전퍼스킬: '전체 퍼센트 스킬', 전격스킬: '전격 스킬', 위습생성: '위습 생성', 목재복사: '목재 복사', 바제스: '바제스', 도시락: '도시락',
  버프부여: '버프 부여', 마뎀끝딜: '마법 끝딜', 범위끝딜: '범위 끝딜', 단일스턴: '단일 스턴', 희귀함이하구매: '희귀함 이하 구매', 배제작: '배 제작',
};

/** 요약 한 토큰을 읽기 쉬운 줄로 바꾼다. 모르는 토큰은 그대로. */
export function expandToken(tok: string): string {
  const t = tok.trim();
  if (!t) return '';
  if (WORDS[t]) return WORDS[t];
  for (const [re, label, unit] of NUMERIC) {
    const m = t.match(re);
    if (m) return m[1] !== undefined ? `${label} : ${m[1]}${unit}` : label;
  }
  return t;
}

export function expandNote(note: string | undefined): string[] {
  if (!note) return [];
  return note.split(/[,/]/).map(expandToken).filter(Boolean);
}

const COND_TEXT: Record<string, (c: Condition) => string> = {
  change_count: (c) => `변화가능 횟수 ${c.value}`,
  skill_points: (c) => `특성포인트 ${c.value}`,
  round_max: (c) => `${c.value}라운드까지만 조합 가능`,
  random_pick: (c) => `랜덤전용 유닛 ${c.value}기`,
  greenblood: () => '기록지침 [그린블러드]',
  unique: () => '플레이어당 1기',
  king: () => '',
};

export interface HoverLine {
  text: string;
  /** 이미 보유한 재료: 가운데 줄 + 회색 */
  done?: boolean;
  muted?: boolean;
  ok?: boolean;
  warn?: boolean;
}

export interface HoverContent {
  title: string;
  recipe: HoverLine[];
  features: string[];
  /** 패 활용순일 때: 이 조합이 쓰는 내 보유 패 (흔함 제외, 높은 등급부터). 오른쪽 칸에 표시 */
  used?: string[];
  /** 특징 구역 없이 제목 + 줄만 보여 주는 설명 카드 (필터 라벨, 계산기 행 등) */
  plain?: boolean;
  /** 특징 아래 구분선 뒤에 덧붙이는 줄 (보유/부족/기여 등) */
  extra?: HoverLine[];
}

export function buildHover(
  unit: Unit,
  entry: { label?: string; note?: string; tier?: string },
  recipe: Recipe | undefined,
  unitName: (id: string) => string,
  combo?: ComboStatus,
): HoverContent {
  const title = [entry.tier ? `(${entry.tier})` : '', entry.label ?? unit.name, unit.grade ? `· ${unit.grade}` : ''].filter(Boolean).join(' ');
  const lines: HoverLine[] = [];
  const push = (text: string, done = false) => lines.push({ text, done });
  if (recipe && recipe.kind === 'craft') {
    // 보유한 재료(부족 목록에 없는 것)는 done 표시
    const missing = new Set((combo?.missing ?? []).map((m) => m.unit));
    const evaluated = !!combo;
    for (const m of recipe.materials) push(unitName(m.unit) + (m.count > 1 ? ` ×${m.count}` : ''), evaluated && !missing.has(m.unit));
    if (recipe.gold) push(`골드 ${recipe.gold.toLocaleString()}`, combo?.gold_ok === true);
    if (recipe.wood) push(`목재 ${recipe.wood}`, combo?.wood_ok === true);
    if (recipe.woodIncremental) push(`목재 ${recipe.woodIncremental} (조합마다 증가)`);
    for (const i of recipe.items) push(`아이템 : ${i.name}`);
    for (const c of recipe.conditions) {
      const t = (COND_TEXT[c.type] ?? ((x: Condition) => `${x.type} ${x.value}`))(c);
      if (t) push(t);
    }
    if (combo?.craftable) push('▶ 지금 조합 가능');
  } else if (recipe?.kind === 'random_only') push('랜덤전용 (조합 불가)');
  else if (recipe?.kind === 'special') push('특수 획득 (조합 불가)');
  else if (unit.grade === '흔함') push('뽑기');
  else push('조합식 없음');

  // 특징은 괄호 요약만. 추출 태그(unit.tags)는 보여 주지 않는다.
  const features = expandNote(entry.note);
  return { title, recipe: lines, features };
}

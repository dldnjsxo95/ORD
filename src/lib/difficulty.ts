// 난이도별 적 능력치 (2.323 [C] 맵 스크립트 모드 설정 블록에서 확인, 2026-10-24).
// - 적 이동속도: 라인몹 기본 300. "모드별 이속증가" 업그레이드 +29/레벨 (어려움 1, 지옥 2, 신·악몽 3).
//   신·악몽은 언홀리 오라 +25%, 악몽은 인내 오라 +10% 추가.
//   워크래프트 3 는 퍼센트 보정(오라·이감)을 서로 더한 뒤 곱한다: 이속 = (300 + 29×레벨) × (1 + 오라 − 이감).
//   게임 상수 MinUnitSpeed 89 / MaxUnitSpeed 490. 최저 89 에 닿는 이감이 "풀이감": 신 102%, 악몽 112% (커뮤니티 수치와 일치).
// - 스턴 저항: 신·악몽에서만 "신모드 이상 스턴저항력"이 연구되어 보스 11종의 저항성 피부(스턴 더미의 영웅 지속 = 보통 50%)가 켜진다.
//   라인몹은 저항 없음. 사용자 결정으로 앱은 라인·보스에 같은 값을 쓴다.
export interface DifficultyProfile {
  /** 게임에서 읽은 이름. 못 읽으면 null (아래 값은 신 기준 가정) */
  name: string | null;
  /** 모드별 이속증가 레벨 */
  speedLevel: number;
  /** 오라 합계 (0.25 = +25%) */
  aura: number;
  /** 기본 300 + 29×레벨 */
  baseSpeed: number;
  /** 이감 없을 때 적 이속 (상한 490) */
  enemySpeed: number;
  /** 풀이감: 최저 이속 89 에 닿는 이감 합계 (1.02 = 102%) */
  fullSlow: number;
  /** 최대 이속 490 에 닿는 이감 (음수: 이감이 이보다 작으면 더 안 빨라짐) */
  speedUpCap: number;
  /** 스턴 지속 감소율 (%) — 보스 기준 */
  stunResist: number;
}

const BASE_SPEED = 300;
const MIN_SPEED = 89;
const MAX_SPEED = 490;

const TABLE: Record<string, { speedLevel: number; aura: number; stunResist: number }> = {
  쉬움: { speedLevel: 0, aura: 0, stunResist: 0 },
  보통: { speedLevel: 0, aura: 0, stunResist: 0 },
  어려움: { speedLevel: 1, aura: 0, stunResist: 0 },
  지옥: { speedLevel: 2, aura: 0, stunResist: 0 },
  신: { speedLevel: 3, aura: 0.25, stunResist: 50 },
  악몽: { speedLevel: 3, aura: 0.35, stunResist: 50 },
};

/** 색 코드가 남아 있어도 받아들인다 ("|cffffd700신|r" → "신") */
export function normalizeDifficulty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const plain = raw.replace(/\|c[0-9a-fA-F]{8}/g, '').replace(/\|r/g, '').trim();
  return plain in TABLE ? plain : null;
}

export function difficultyProfile(raw: string | null | undefined): DifficultyProfile {
  const name = normalizeDifficulty(raw);
  const t = TABLE[name ?? '신'];
  const baseSpeed = BASE_SPEED + 29 * t.speedLevel;
  return {
    name,
    speedLevel: t.speedLevel,
    aura: t.aura,
    baseSpeed,
    enemySpeed: Math.min(MAX_SPEED, baseSpeed * (1 + t.aura)),
    fullSlow: 1 + t.aura - MIN_SPEED / baseSpeed,
    speedUpCap: 1 + t.aura - MAX_SPEED / baseSpeed,
    stunResist: t.stunResist,
  };
}

/** 이감 합계(0.4 = 40%)를 넣으면 실제 적 이속 (최저 89 · 최대 490 적용) */
export function enemySpeedWithSlow(p: DifficultyProfile, slow: number): number {
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, p.baseSpeed * (1 + p.aura - slow)));
}

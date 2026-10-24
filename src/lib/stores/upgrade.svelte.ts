// 업그레이드 가정값 (아머브레이크 초당 환산용). localStorage 에 보존.
// 유닛별 공속 업그레이드의 기본 증가량·레벨당 증가폭·최대 레벨은 맵에서 추출한 data/upgrades.json 을 쓴다. 여기엔 "지금 몇 레벨인가"와 상한만 둔다.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

export interface UpgradeState {
  /** 현재 업그레이드 레벨 (모든 등급 공통 가정). 0 = 미연구 */
  level: number;
  /** 공격속도 보너스 상한 (%) — 워크래프트 3 기본 400 */
  speedCap: number;
  /** 신비 유닛 최종 공격속도 +25% (랜덤전용 업그레이드 설명) 적용 */
  mysticBonus: boolean;
  /** 스턴 저항을 게임에서 읽은 난이도로 자동 결정 (신·악몽 50, 그 아래 0). 꺼면 stunResist 수동값 */
  stunAuto: boolean;
  /** 수동 스턴 저항: 스턴 지속 감소율 (%). 사용자 결정으로 라인몹에도 보스와 같은 값 적용 */
  stunResist: number;
  /** 실질 방어력 감소에서 아머브레이크 누적을 셈할 전투 시간 (초) */
  fightSeconds: number;
}

const KEY = 'ord-helper.upgrade';
/** 맵의 등급 업그레이드 최대 레벨 (data/upgrades.json 의 max 와 같음) */
export const MAX_LEVEL = 21;
const BASE: UpgradeState = { level: MAX_LEVEL, speedCap: 400, mysticBonus: true, stunAuto: true, stunResist: 50, fightSeconds: 20 };

function load(): UpgradeState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...BASE };
    const s = JSON.parse(raw);
    return { ...BASE, ...s };
  } catch {
    return { ...BASE };
  }
}

export const upgrade = $state<UpgradeState>(load());

export function saveUpgrade() {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(upgrade)));
  } catch {
    /* 무시 */
  }
}

export function setUpgradeLevel(level: number) {
  upgrade.level = Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
  saveUpgrade();
}

export function resetUpgrade() {
  Object.assign(upgrade, BASE);
  saveUpgrade();
}

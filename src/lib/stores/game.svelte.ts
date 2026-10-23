// 게임 상태 스토어: 백엔드 이벤트를 받아 화면 어디서나 읽을 수 있게 한다.
// 게임 규칙 계산은 여기 두지 않는다 (ord-core 가 한다). 이름 조회와 집계만 한다.

import { api, type Database, type StatePayload } from '$lib/api';

interface GameStore {
  db: Database | null;
  payload: StatePayload | null;
  watching: boolean;
  dir: string;
  error: string;
  lastAt: string;
  log: string[];
}

export const game = $state<GameStore>({
  db: null,
  payload: null,
  watching: false,
  dir: '',
  error: '',
  lastAt: '',
  log: [],
});

function now() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

export function pushLog(message: string) {
  game.log = [`${now()}  ${message}`, ...game.log].slice(0, 300);
}

export function unitName(id: string): string {
  return game.db?.units.find((u) => u.id === id)?.name ?? id;
}

export function unitTier(id: string): number {
  return game.db?.units.find((u) => u.id === id)?.tier ?? 0;
}

export function ownedTotal(): number {
  return Object.values(game.payload?.state.units ?? {}).reduce((a, b) => a + b, 0);
}

export function craftableCount(): number {
  return game.payload?.combos.filter((c) => c.craftable).length ?? 0;
}

let started = false;
const unlisteners: Array<() => void> = [];

/** 앱 시작 시 한 번: DB 로드, 이벤트 구독, 기본 폴더로 감시 자동 시작. */
export async function initGame() {
  if (started) return;
  started = true;
  try {
    game.db = await api.getDatabase();
    game.dir = (await api.defaultDir()) ?? '';
    pushLog(`조합 DB ${game.db.version}: 유닛 ${game.db.units.length}종, 조합식 ${game.db.recipes.length}개`);
    unlisteners.push(
      await api.onState((p) => {
        game.payload = p;
        game.lastAt = now();
      }),
      await api.onStatus((s) => {
        if (s.kind === 'watching') {
          game.watching = true;
          pushLog(`감시 시작: ${s.dir}`);
        } else if (s.kind === 'stopped') {
          game.watching = false;
          pushLog('감시 중지');
        } else {
          game.error = s.message;
          pushLog(`오류: ${s.message}`);
        }
      }),
    );
    await startWatch();
  } catch (e) {
    game.error = String(e);
    pushLog(`초기화 실패: ${e}`);
  }
}

export async function startWatch() {
  try {
    game.dir = await api.startWatch(game.dir || undefined);
    game.error = '';
  } catch (e) {
    game.error = `시작 실패: ${e}`;
    pushLog(game.error);
  }
}

export async function stopWatch() {
  await api.stopWatch();
}

export function disposeGame() {
  unlisteners.splice(0).forEach((u) => u());
  started = false;
}

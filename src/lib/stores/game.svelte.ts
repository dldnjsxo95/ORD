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
const DIR_KEY = 'ord-helper.dir';

/** 사용자가 설정에서 정한 폴더. 없으면 백엔드 기본값. */
async function resolveDir(): Promise<string> {
  try {
    const saved = localStorage.getItem(DIR_KEY);
    if (saved && saved.trim()) return saved;
  } catch {
    /* localStorage 를 못 쓰면 기본값으로 */
  }
  return (await api.defaultDir()) ?? '';
}

/** 앱 시작 시 한 번: DB 로드, 이벤트 구독, 저장된 폴더(없으면 기본 폴더)로 감시 자동 시작. */
export async function initGame() {
  if (started) return;
  started = true;
  try {
    game.db = await api.getDatabase();
    game.dir = await resolveDir();
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

/** 현재 game.dir 로 감시를 (다시) 시작한다. 이미 감시 중이면 백엔드가 이전 감시를 교체한다. */
export async function startWatch() {
  try {
    game.dir = await api.startWatch(game.dir || undefined);
    game.error = '';
  } catch (e) {
    game.error = `시작 실패: ${e}`;
    pushLog(game.error);
  }
}

/** 설정에서 폴더를 바꿨을 때: 저장하고 즉시 그 폴더로 감시를 옮긴다. 빈 값이면 기본 폴더로 돌아간다. */
export async function changeDir(dir: string) {
  const next = dir.trim();
  try {
    if (next) localStorage.setItem(DIR_KEY, next);
    else localStorage.removeItem(DIR_KEY);
  } catch {
    /* 저장 실패는 무시 */
  }
  game.dir = next || ((await api.defaultDir()) ?? '');
  game.payload = null;
  await startWatch();
}

export async function defaultDir(): Promise<string> {
  return (await api.defaultDir()) ?? '';
}

export function disposeGame() {
  unlisteners.splice(0).forEach((u) => u());
  started = false;
}

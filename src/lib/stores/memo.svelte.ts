// 유닛별 메모. 백엔드가 %LOCALAPPDATA%\ord-helper\memos.json 에 저장하므로 앱을 다시 빌드·설치해도 남는다.
// 백엔드를 못 쓰는 환경(브라우저 dev)에서는 localStorage 로 대신한다.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

import { api } from '$lib/api';

const LS_KEY = 'ord-helper.memos';

interface MemoState {
  memos: Record<string, string>;
  loaded: boolean;
  /** 마지막 저장 오류 (없으면 null) */
  error: string | null;
}

export const memo = $state<MemoState>({ memos: {}, loaded: false, error: null });

function readLocal(): Record<string, string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeLocal(m: Record<string, string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {
    /* 무시 */
  }
}

/** 앱 시작 시 한 번: 파일(백엔드) → 실패하면 localStorage */
export async function initMemos() {
  if (memo.loaded) return;
  try {
    const fromFile = await api.loadMemos();
    const local = readLocal();
    // 파일이 비어 있고 localStorage 에만 있으면(옛 저장) 파일로 옮긴다
    memo.memos = Object.keys(fromFile).length ? fromFile : local;
    if (!Object.keys(fromFile).length && Object.keys(local).length) void api.saveMemos(local).catch(() => {});
  } catch {
    memo.memos = readLocal();
  }
  memo.loaded = true;
}

export function memoOf(id: string): string {
  return memo.memos[id] ?? '';
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** 메모 변경: 즉시 상태 반영, 저장은 0.5초 뒤 한 번 (타이핑 중 반복 저장 방지). 빈 메모는 지운다 */
export function setMemo(id: string, text: string) {
  const t = text.trim();
  if (t) memo.memos[id] = text;
  else delete memo.memos[id];
  writeLocal(memo.memos);
  clearTimeout(timer);
  timer = setTimeout(() => void flushMemos(), 500);
}

export async function flushMemos() {
  clearTimeout(timer);
  try {
    await api.saveMemos($state.snapshot(memo.memos));
    memo.error = null;
  } catch (e) {
    memo.error = String(e);
  }
}

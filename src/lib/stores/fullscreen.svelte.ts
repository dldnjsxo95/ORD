// 전체화면 상태. 창 API 호출은 모두 여기서 하고, 화면은 fullscreen.active 만 읽는다.
//
// 주의: 최대화된 창을 그대로 전체화면으로 바꾸면 Windows 에서 창은 모니터 전체 크기가 되지만
// 클라이언트 영역은 작업표시줄 높이만큼 잘린다 (tao 0.37 WM_NCCALCSIZE 의 is_maximized 분기가
// 최대화 스타일이 남아 있는 전체화면 창에도 적용됨). 그래서 먼저 최대화를 풀고 들어가고,
// 나올 때 원래 최대화 상태였으면 다시 최대화한다.
import { getCurrentWindow } from '@tauri-apps/api/window';

// 개발 모드: 이 모듈이 바뀌면 페이지 전체를 다시 불러온다
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

export const fullscreen = $state({ active: false });

const win = getCurrentWindow();
let wasMaximized = false;
let busy = false;

/** 앱 시작 시 창의 실제 상태와 맞춘다 */
export async function syncFullscreen() {
  try {
    fullscreen.active = await win.isFullscreen();
  } catch {
    /* 브라우저에서 열었을 때 등: 무시 */
  }
}

export async function enterFullscreen() {
  if (busy || fullscreen.active) return;
  busy = true;
  try {
    wasMaximized = await win.isMaximized();
    if (wasMaximized) await win.unmaximize();
    await win.setFullscreen(true);
    fullscreen.active = true;
  } finally {
    busy = false;
  }
}

export async function exitFullscreen() {
  if (busy || !fullscreen.active) return;
  busy = true;
  try {
    await win.setFullscreen(false);
    fullscreen.active = false;
    if (wasMaximized) await win.maximize();
    wasMaximized = false;
  } finally {
    busy = false;
  }
}

export function toggleFullscreen() {
  return fullscreen.active ? exitFullscreen() : enterFullscreen();
}

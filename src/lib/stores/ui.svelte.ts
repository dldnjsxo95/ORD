// 셸 UI 상태 (테마, 하단 패널, 설정 모달). 설정 모달 열림은 저장하지 않고 나머지는 localStorage 에 보존한다.
// 개발 모드: 이 모듈이 바뀌면 페이지 전체를 다시 불러온다
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  bottomVisible: boolean;
  bottomHeight: number;
  /** 설정 모달 열림 (세션 한정, 저장하지 않음) */
  settingsOpen: boolean;
}

const KEY = 'ord-helper.ui';

function load(): UiState {
  const base: UiState = { theme: 'dark', bottomVisible: false, bottomHeight: 180, settingsOpen: false };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const saved: UiState = raw ? { ...base, ...JSON.parse(raw) } : base;
    saved.settingsOpen = false;
    return saved;
  } catch {
    return base;
  }
}

export const ui = $state<UiState>(load());

function save() {
  try {
    const { settingsOpen: _open, ...persisted } = ui;
    localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function setTheme(theme: Theme) {
  ui.theme = theme;
  save();
}

export function setSettingsOpen(open: boolean) {
  ui.settingsOpen = open;
}

export function setBottomVisible(visible: boolean) {
  ui.bottomVisible = visible;
  save();
}

export function setBottomHeight(height: number) {
  ui.bottomHeight = height;
  save();
}

// 셸 UI 상태 (테마, 활성 뷰, 하단 패널). localStorage 에 보존한다.

export type ViewId = 'main' | 'settings';
export type Theme = 'dark' | 'light';

export const VIEWS: Record<ViewId, { title: string; icon: 'layers' | 'settings' }> = {
  main: { title: '조합', icon: 'layers' },
  settings: { title: '설정', icon: 'settings' },
};

interface UiState {
  theme: Theme;
  view: ViewId;
  bottomVisible: boolean;
  bottomHeight: number;
}

const KEY = 'ord-helper.ui';

function load(): UiState {
  const base: UiState = { theme: 'dark', view: 'main', bottomVisible: false, bottomHeight: 180 };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const saved = raw ? { ...base, ...JSON.parse(raw) } : base;
    if (!(saved.view in VIEWS)) saved.view = 'main'; // 예전 뷰 id 호환
    return saved;
  } catch {
    return base;
  }
}

export const ui = $state<UiState>(load());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(ui));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function setTheme(theme: Theme) {
  ui.theme = theme;
  save();
}

export function setView(view: ViewId) {
  ui.view = view;
  save();
}

export function setBottomVisible(visible: boolean) {
  ui.bottomVisible = visible;
  save();
}

export function setBottomHeight(height: number) {
  ui.bottomHeight = height;
  save();
}

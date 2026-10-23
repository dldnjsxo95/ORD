// 셸 UI 상태 (테마, 활성 뷰, 하단 패널). localStorage 에 보존한다.

export type ViewId = 'combos' | 'units' | 'settings';
export type Theme = 'dark' | 'light';

export const VIEWS: Record<ViewId, { title: string; icon: 'layers' | 'cube' | 'settings' }> = {
  combos: { title: '조합', icon: 'layers' },
  units: { title: '유닛', icon: 'cube' },
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
  const base: UiState = { theme: 'dark', view: 'combos', bottomVisible: false, bottomHeight: 180 };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...base, ...JSON.parse(raw) } : base;
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

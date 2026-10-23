// 호버 카드 상태: 유닛 행 위에 마우스를 올리면 내용과 위치를 채운다.
// 개발 모드: 이 모듈이 바뀌면 페이지 전체를 다시 불러온다
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

import type { HoverContent } from '$lib/tooltip';

interface HoverState {
  content: HoverContent | null;
  x: number;
  y: number;
}

export const hover = $state<HoverState>({ content: null, x: 0, y: 0 });

export function showHover(content: HoverContent, x: number, y: number) {
  hover.content = content;
  hover.x = x;
  hover.y = y;
}

export function moveHover(x: number, y: number) {
  hover.x = x;
  hover.y = y;
}

export function hideHover() {
  hover.content = null;
}

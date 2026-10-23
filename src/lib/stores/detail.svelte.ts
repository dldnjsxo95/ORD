// 조합 상세 모달 상태: 현재 유닛과 뒤로/앞으로 히스토리 (브라우저 히스토리처럼 동작).
//   뒤로: 이전 유닛으로, 이전이 없으면 모달을 닫는다 (닫힌 뒤에도 앞으로가기로 다시 열 수 있다)
//   앞으로: 뒤로가기로 떠난 유닛으로 다시 들어간다
//   새 유닛으로 이동하면 앞으로 스택은 비운다
// 개발 모드: 이 모듈이 바뀌면 페이지 전체를 다시 불러온다
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

interface DetailState {
  /** 열려 있으면 현재 보고 있는 유닛 id, 아니면 null */
  current: string | null;
  /** 이전에 보던 유닛들 (뒤로가기) */
  stack: string[];
  /** 뒤로가기로 떠난 유닛들 (앞으로가기) */
  forward: string[];
}

export const detail = $state<DetailState>({ current: null, stack: [], forward: [] });

/** 메인 화면에서 열기: 히스토리를 비우고 시작 */
export function openDetail(id: string) {
  detail.stack = [];
  detail.forward = [];
  detail.current = id;
}

/** 모달 안에서 다른 유닛으로 이동: 현재 유닛을 히스토리에 쌓는다 */
export function pushDetail(id: string) {
  if (!detail.current || detail.current === id) return;
  detail.stack = [...detail.stack, detail.current];
  detail.forward = [];
  detail.current = id;
}

/** 뒤로: 이전 유닛으로, 이전이 없으면 모달을 닫는다 */
export function backDetail() {
  if (!detail.current) return;
  detail.forward = [...detail.forward, detail.current];
  if (detail.stack.length === 0) {
    detail.current = null;
    return;
  }
  detail.current = detail.stack[detail.stack.length - 1];
  detail.stack = detail.stack.slice(0, -1);
}

/** 앞으로: 뒤로가기로 떠난 유닛으로 (모달이 닫혀 있었으면 다시 연다) */
export function forwardDetail() {
  if (detail.forward.length === 0) return;
  const next = detail.forward[detail.forward.length - 1];
  detail.forward = detail.forward.slice(0, -1);
  if (detail.current) detail.stack = [...detail.stack, detail.current];
  detail.current = next;
}

export function canForward(): boolean {
  return detail.forward.length > 0;
}

/** 닫기(ESC·✕·배경 클릭): 히스토리까지 비운다 */
export function closeDetail() {
  detail.current = null;
  detail.stack = [];
  detail.forward = [];
}

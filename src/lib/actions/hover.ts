// 호버 카드 액션: 유닛 행이 아닌 요소(필터 라벨, 능력치 행, 추천 칩 등)에도 같은 디자인의 호버 카드를 띄운다.
// 사용: <div use:hoverCard={() => content}> — 마우스가 올라오면 content() 를 만들어 보여 주고, 움직이면 따라가고, 나가면 닫는다.
// 브라우저 기본 title 툴팁 대신 쓴다 (title 은 생김새가 다르고 늦게 뜬다).
import { buildHover, type HoverContent, type HoverLine } from '$lib/tooltip';
import { showHover, moveHover, hideHover } from '$lib/stores/hover.svelte';
import { game, recipeOf, unitName, base, craftWord } from '$lib/stores/game.svelte';
import { memoOf } from '$lib/stores/memo.svelte';
import { ENTRY_BY_ID } from '$lib/layout';

export type HoverSource = () => HoverContent | null | undefined;

export function hoverCard(node: HTMLElement, source: HoverSource) {
  let current = source;
  const enter = (e: MouseEvent) => {
    const c = current();
    if (c) showHover(c, e.clientX, e.clientY);
  };
  const move = (e: MouseEvent) => moveHover(e.clientX, e.clientY);
  node.addEventListener('mouseenter', enter);
  node.addEventListener('mousemove', move);
  node.addEventListener('mouseleave', hideHover);
  return {
    update(next: HoverSource) {
      current = next;
    },
    destroy() {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mousemove', move);
      node.removeEventListener('mouseleave', hideHover);
      hideHover();
    },
  };
}

const toLines = (lines: Array<string | HoverLine>): HoverLine[] => lines.filter(Boolean).map((l) => (typeof l === 'string' ? { text: l } : l));

/** 설명만 있는 카드: 제목 + 줄들 (특징 구역 없음) */
export function infoCard(title: string, lines: Array<string | HoverLine> = []): HoverContent {
  return { title, recipe: toLines(lines), features: [], plain: true };
}

/**
 * 유닛 카드 (유닛 행과 같은 내용: 조합식 → 특징) 에 추가 줄(보유/부족/기여 등)을 덧붙인다.
 * DB 에 없는 id 면 이름만 있는 설명 카드를 돌려준다.
 */
export function unitCard(id: string, extra: Array<string | HoverLine> = []): HoverContent {
  const u = game.db?.units.find((x) => x.id === id);
  const entry = ENTRY_BY_ID.get(id);
  if (!u) return infoCard(entry?.label ?? unitName(id), extra);
  const recipe = recipeOf(id) ?? recipeOf(base(id));
  const combo = game.payload?.combos.find((c) => c.result === id);
  const content = buildHover(u, { label: entry?.label, note: entry?.note, tier: entry?.tier, word: craftWord(id) }, recipe, unitName, combo);
  const ex = toLines(extra);
  if (ex.length) content.extra = ex;
  const m = memoOf(id);
  if (m) content.memo = m;
  return content;
}

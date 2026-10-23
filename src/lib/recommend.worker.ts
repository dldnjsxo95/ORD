// 추천 조합 계산을 화면 스레드 밖에서 돌리는 워커. DB 는 한 번만 받고, 요청마다 남은 패·진화체·후보를 받아 결과를 돌려준다.
// 요청에는 seq 가 붙어 있어 늦게 도착한 옛 결과는 호출자가 버린다.
import type { Database } from '$lib/api';
import { recommend, type Recommendation, type RecommendOpts } from './recommend';

export interface RunRequest {
  type: 'run';
  seq: number;
  counts: Array<[string, number]>;
  evolution: string | null;
  opts: RecommendOpts;
}
export interface DbRequest {
  type: 'db';
  db: Database;
}
export interface RunResult {
  seq: number;
  result: Recommendation;
}

let db: Database | null = null;

self.onmessage = (e: MessageEvent<RunRequest | DbRequest>) => {
  const m = e.data;
  if (m.type === 'db') {
    db = m.db;
    return;
  }
  if (!db) return;
  const result = recommend(db, new Map(m.counts), m.evolution, m.opts);
  (self as unknown as Worker).postMessage({ seq: m.seq, result } satisfies RunResult);
};

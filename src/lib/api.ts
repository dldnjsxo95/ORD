// Rust 백엔드(src-tauri/src/watcher.rs)와의 경계. 타입은 ord-core 의 모델과 1:1 로 맞춘다.
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface Unit {
  id: string;
  name: string;
  tier: number;
  icon?: string;
}
export interface Ingredient {
  unit: string;
  count: number;
}
export interface Recipe {
  result: string;
  inputs: Ingredient[];
}
export interface Database {
  version: string;
  units: Unit[];
  recipes: Recipe[];
}
export interface GameState {
  v: number;
  t: number;
  map: string;
  player: number;
  gold: number;
  units: Record<string, number>;
}
export interface ComboStatus {
  result: string;
  result_name: string;
  craftable: boolean;
  missing: Ingredient[];
  have: number;
  need: number;
}
export interface StatePayload {
  file: string;
  state: GameState;
  combos: ComboStatus[];
}
export type StatusPayload =
  | { kind: 'watching'; dir: string }
  | { kind: 'stopped' }
  | { kind: 'error'; message: string };

export const api = {
  defaultDir: () => invoke<string | null>('default_dir'),
  startWatch: (dir?: string) => invoke<string>('start_watch', { dir: dir ?? null }),
  stopWatch: () => invoke<void>('stop_watch'),
  getDatabase: () => invoke<Database>('get_database'),
  simulate: (units: Record<string, number>) => invoke<ComboStatus[]>('simulate', { units }),
  onState: (cb: (p: StatePayload) => void): Promise<UnlistenFn> =>
    listen<StatePayload>('ord://state', (e) => cb(e.payload)),
  onStatus: (cb: (p: StatusPayload) => void): Promise<UnlistenFn> =>
    listen<StatusPayload>('ord://status', (e) => cb(e.payload)),
};

// Rust 백엔드(src-tauri/src/watcher.rs)와의 경계. 타입은 ord-core 의 모델과 1:1 로 맞춘다 (JSON 은 camelCase).
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface Attack {
  type: string;
  base: number;
  dice: number;
  sides: number;
  range: number;
  cooldown: number;
}
export interface Skill {
  id: string;
  name: string;
  tip: string;
}
export interface Unit {
  id: string;
  name: string;
  grade: string | null;
  title?: string;
  icon?: string | null;
  level?: number | null;
  attack?: Attack | null;
  damageHint?: string | null;
  baseForm?: string | null;
  summon?: boolean;
  aliases?: string[];
  skills: Skill[];
}
export interface Ingredient {
  unit: string;
  count: number;
}
export interface ItemReq {
  id: string;
  name: string;
}
export interface Condition {
  type: string;
  value: number;
  raw?: string;
}
export type RecipeKind = 'craft' | 'special' | 'random_only';
export interface Recipe {
  id: string;
  result: string;
  kind: RecipeKind;
  materials: Ingredient[];
  gold: number;
  wood: number;
  woodIncremental: number;
  items: ItemReq[];
  conditions: Condition[];
  upperUnits: string[];
}
export interface Database {
  version: string;
  extractedAt?: string;
  source?: string;
  grades: string[];
  units: Unit[];
  recipes: Recipe[];
}
export interface GameState {
  v: number;
  t: number;
  map: string;
  player: number;
  gold: number;
  wood: number | null;
  units: Record<string, number>;
}
export interface OwnedUnit {
  id: string;
  count: number;
  known: boolean;
}
export interface ComboStatus {
  recipe_id: string;
  result: string;
  result_name: string;
  result_grade: string | null;
  craftable: boolean;
  materials_ok: boolean;
  missing: Ingredient[];
  have: number;
  need: number;
  gold: number;
  wood: number;
  wood_incremental: number;
  gold_ok: boolean | null;
  wood_ok: boolean | null;
  items: ItemReq[];
  conditions: Condition[];
}
export interface StatePayload {
  file: string;
  state: GameState;
  owned: OwnedUnit[];
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
  simulate: (units: Record<string, number>, gold?: number, wood?: number) =>
    invoke<ComboStatus[]>('simulate', { units, gold: gold ?? null, wood: wood ?? null }),
  onState: (cb: (p: StatePayload) => void): Promise<UnlistenFn> =>
    listen<StatePayload>('ord://state', (e) => cb(e.payload)),
  onStatus: (cb: (p: StatusPayload) => void): Promise<UnlistenFn> =>
    listen<StatusPayload>('ord://status', (e) => cb(e.payload)),
};

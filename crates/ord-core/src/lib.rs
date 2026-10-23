//! ord-core: 원피스 랜덤 디펜스 조합 계산 엔진.
//!
//! Tauri 나 게임에 의존하지 않는 순수 라이브러리. 입력은 두 가지다.
//! - `Database`: data/ord-<버전>.json (맵에서 추출한 유닛·조합식·스킬)
//! - `GameState`: 내보내기 스크립트가 쓰는 state.json (보유 유닛과 자원)

pub mod model;
pub mod solver;

pub use model::{Attack, Condition, Database, GameState, Ingredient, ItemReq, Recipe, RecipeKind, Skill, Unit};
pub use solver::{ComboStatus, OwnedUnit, base_of, evaluate, normalize_owned};


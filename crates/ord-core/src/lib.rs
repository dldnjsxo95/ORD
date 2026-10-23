//! ord-core: 원피스 랜덤 디펜스 조합 계산 엔진.
//!
//! Tauri 나 게임에 의존하지 않는 순수 라이브러리. 입력은 두 가지다.
//! - `Database`: data/recipes.json (유닛 목록과 조합식)
//! - `GameState`: 내보내기 스크립트가 쓰는 state.json (보유 유닛)

pub mod model;
pub mod solver;

pub use model::{Database, GameState, Ingredient, Recipe, Unit};
pub use solver::{ComboStatus, evaluate};

#[cfg(test)]
mod tests {
    use super::*;

    /// 저장소에 들어 있는 샘플 DB 가 항상 유효해야 한다.
    #[test]
    fn bundled_recipes_are_valid() {
        let db = Database::from_json(include_str!("../../../data/recipes.json")).expect("recipes.json 파싱");
        let problems = db.validate();
        assert!(problems.is_empty(), "recipes.json 문제: {problems:#?}");
    }

    /// mock-exporter 가 쓴 state.json 을 그대로 파싱할 수 있어야 한다.
    #[test]
    fn mock_state_fixture_parses() {
        let s = GameState::from_json(include_str!("../../../fixtures/state.mock.json")).expect("state.mock.json 파싱");
        assert_eq!(s.v, 1);
        assert_eq!(s.units.get("o201"), Some(&2));
    }
}

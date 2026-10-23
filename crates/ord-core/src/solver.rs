use std::collections::BTreeMap;

use serde::Serialize;

use crate::model::{Database, Ingredient, Recipe};

/// 조합식 하나에 대한 현재 상태.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ComboStatus {
    pub result: String,
    pub result_name: String,
    /// 지금 바로 조합 가능한지
    pub craftable: bool,
    /// 부족한 재료와 부족 수량
    pub missing: Vec<Ingredient>,
    /// 보유 중인 재료 수 (재료별로 필요 수량까지만 집계)
    pub have: u32,
    /// 필요한 재료 총 수
    pub need: u32,
}

/// 보유 유닛(rawcode -> 수량)으로 모든 조합식을 평가한다.
///
/// 각 조합식은 독립적으로 평가한다. 같은 재료를 두 조합이 공유하는 경우
/// 둘 다 가능으로 표시되며, 실제로 어느 쪽을 택할지는 사용자 판단에 맡긴다.
/// 정렬: 즉시 가능 → 진행도(have/need) 높은 순 → 결과 id.
pub fn evaluate(db: &Database, owned: &BTreeMap<String, u32>) -> Vec<ComboStatus> {
    let mut out: Vec<ComboStatus> = db.recipes.iter().map(|r| status_of(db, r, owned)).collect();
    out.sort_by(|a, b| {
        b.craftable
            .cmp(&a.craftable)
            .then_with(|| (b.have * a.need).cmp(&(a.have * b.need)))
            .then_with(|| a.result.cmp(&b.result))
    });
    out
}

fn status_of(db: &Database, r: &Recipe, owned: &BTreeMap<String, u32>) -> ComboStatus {
    let mut missing = Vec::new();
    let (mut have, mut need) = (0, 0);
    for ing in &r.inputs {
        let h = owned.get(&ing.unit).copied().unwrap_or(0).min(ing.count);
        have += h;
        need += ing.count;
        if h < ing.count {
            missing.push(Ingredient { unit: ing.unit.clone(), count: ing.count - h });
        }
    }
    ComboStatus {
        result: r.result.clone(),
        result_name: db.unit(&r.result).map(|u| u.name.clone()).unwrap_or_default(),
        craftable: missing.is_empty(),
        missing,
        have,
        need,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Unit;

    fn unit(id: &str, name: &str, tier: u8) -> Unit {
        Unit { id: id.into(), name: name.into(), tier, icon: None }
    }

    fn ing(unit: &str, count: u32) -> Ingredient {
        Ingredient { unit: unit.into(), count }
    }

    fn db() -> Database {
        Database {
            version: "test".into(),
            units: vec![unit("u001", "A", 1), unit("u002", "B", 1), unit("u101", "AB", 2), unit("u102", "AA", 2)],
            recipes: vec![
                Recipe { result: "u101".into(), inputs: vec![ing("u001", 1), ing("u002", 1)] },
                Recipe { result: "u102".into(), inputs: vec![ing("u001", 2)] },
            ],
        }
    }

    #[test]
    fn craftable_when_all_inputs_present() {
        let owned = BTreeMap::from([("u001".to_string(), 1), ("u002".to_string(), 1)]);
        let r = evaluate(&db(), &owned);
        let ab = r.iter().find(|c| c.result == "u101").unwrap();
        assert!(ab.craftable);
        assert!(ab.missing.is_empty());
        assert_eq!(ab.result_name, "AB");
    }

    #[test]
    fn reports_missing_counts() {
        let owned = BTreeMap::from([("u001".to_string(), 1)]);
        let r = evaluate(&db(), &owned);
        let aa = r.iter().find(|c| c.result == "u102").unwrap();
        assert!(!aa.craftable);
        assert_eq!(aa.missing, vec![ing("u001", 1)]);
        assert_eq!((aa.have, aa.need), (1, 2));
    }

    #[test]
    fn craftable_sorted_first_then_by_progress() {
        let owned = BTreeMap::from([("u001".to_string(), 2)]);
        let r = evaluate(&db(), &owned);
        assert_eq!(r[0].result, "u102"); // 즉시 가능
        assert_eq!(r[1].result, "u101"); // 1/2 진행
    }

    #[test]
    fn validate_catches_unknown_units() {
        let mut d = db();
        d.recipes.push(Recipe { result: "zzzz".into(), inputs: vec![ing("u001", 1)] });
        assert_eq!(d.validate().len(), 1);
    }
}

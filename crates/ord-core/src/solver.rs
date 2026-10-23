use std::collections::{BTreeMap, HashMap};

use serde::Serialize;

use crate::model::{Condition, Database, Ingredient, ItemReq, Recipe, RecipeKind, Unit};

/// 보유 유닛 한 줄 (변형·분신 정리 후)
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct OwnedUnit {
    pub id: String,
    pub count: u32,
    /// DB 에 없는 rawcode 면 false. UI 는 코드만 표시한다.
    pub known: bool,
}

/// 조합식 하나에 대한 현재 상태.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ComboStatus {
    pub recipe_id: String,
    pub result: String,
    pub result_name: String,
    pub result_grade: Option<String>,
    /// 재료·골드·목재가 모두 충족. 조건(특성포인트 등)은 판정하지 않고 표시만 한다.
    pub craftable: bool,
    pub materials_ok: bool,
    /// 부족한 재료와 부족 수량
    pub missing: Vec<Ingredient>,
    /// 보유 중인 재료 수 (재료별로 필요 수량까지만 집계)
    pub have: u32,
    /// 필요한 재료 총 수
    pub need: u32,
    pub gold: i64,
    pub wood: i64,
    pub wood_incremental: i64,
    /// None = 현재 골드를 몰라서 판정 안 함
    pub gold_ok: Option<bool>,
    pub wood_ok: Option<bool>,
    pub items: Vec<ItemReq>,
    pub conditions: Vec<Condition>,
}

/// 기본 유닛 id 로 환원한다 (변형 체인은 최대 8단계).
pub fn base_of<'a>(index: &HashMap<&'a str, &'a Unit>, id: &'a str) -> &'a str {
    let mut cur = id;
    for _ in 0..8 {
        match index.get(cur).and_then(|u| u.base_form.as_deref()) {
            Some(b) if b != cur => cur = b,
            _ => break,
        }
    }
    cur
}

/// 원본 보유 목록을 정리한다: 분신 제외, 스킨·변형은 기본 유닛으로 합산.
/// DB 에 없는 코드는 그대로 남긴다 (known=false).
pub fn normalize_owned(db: &Database, raw: &BTreeMap<String, u32>) -> Vec<OwnedUnit> {
    let index = db.index();
    let mut merged: BTreeMap<String, u32> = BTreeMap::new();
    for (id, n) in raw {
        if *n == 0 {
            continue;
        }
        if let Some(u) = index.get(id.as_str()) {
            if u.summon {
                continue;
            }
            *merged.entry(base_of(&index, id).to_string()).or_insert(0) += n;
        } else {
            *merged.entry(id.clone()).or_insert(0) += n;
        }
    }
    let mut out: Vec<OwnedUnit> = merged
        .into_iter()
        .map(|(id, count)| OwnedUnit { known: index.contains_key(id.as_str()), id, count })
        .collect();
    // 높은 등급 먼저, 같은 등급은 이름순
    out.sort_by(|a, b| {
        let ga = index.get(a.id.as_str()).and_then(|u| u.grade.as_deref());
        let gb = index.get(b.id.as_str()).and_then(|u| u.grade.as_deref());
        db.grade_rank(gb).cmp(&db.grade_rank(ga)).then_with(|| a.id.cmp(&b.id))
    });
    out
}

/// 보유 유닛(원본 rawcode -> 수량)과 자원으로 모든 조합식을 평가한다.
///
/// 각 조합식은 독립적으로 평가한다. 같은 재료를 두 조합이 공유하면 둘 다 가능으로 표시되며,
/// 어느 쪽을 택할지는 사용자 판단에 맡긴다.
/// 정렬: 조합 가능 → 진행도(have/need) 높은 순 → 결과 등급 높은 순 → 결과 id.
pub fn evaluate(db: &Database, raw_owned: &BTreeMap<String, u32>, gold: Option<i64>, wood: Option<i64>) -> Vec<ComboStatus> {
    let index = db.index();
    let owned: HashMap<String, u32> = normalize_owned(db, raw_owned).into_iter().map(|o| (o.id, o.count)).collect();
    let mut out: Vec<ComboStatus> = db
        .recipes
        .iter()
        .filter(|r| r.kind == RecipeKind::Craft)
        .map(|r| status_of(db, &index, r, &owned, gold, wood))
        .collect();
    out.sort_by(|a, b| {
        b.craftable
            .cmp(&a.craftable)
            .then_with(|| (b.have as u64 * a.need as u64).cmp(&(a.have as u64 * b.need as u64)))
            .then_with(|| db.grade_rank(b.result_grade.as_deref()).cmp(&db.grade_rank(a.result_grade.as_deref())))
            .then_with(|| a.result.cmp(&b.result))
    });
    out
}

fn status_of(
    db: &Database,
    index: &HashMap<&str, &Unit>,
    r: &Recipe,
    owned: &HashMap<String, u32>,
    gold: Option<i64>,
    wood: Option<i64>,
) -> ComboStatus {
    let mut missing = Vec::new();
    let (mut have, mut need) = (0, 0);
    for ing in &r.materials {
        let base = base_of(index, &ing.unit);
        let h = owned.get(base).copied().unwrap_or(0).min(ing.count);
        have += h;
        need += ing.count;
        if h < ing.count {
            missing.push(Ingredient { unit: ing.unit.clone(), count: ing.count - h });
        }
    }
    let materials_ok = missing.is_empty();
    let gold_ok = gold.map(|g| g >= r.gold);
    let wood_ok = wood.map(|w| w >= r.wood + r.wood_incremental);
    let result_unit = index.get(r.result.as_str());
    ComboStatus {
        recipe_id: r.id.clone(),
        result: r.result.clone(),
        result_name: result_unit.map(|u| u.name.clone()).unwrap_or_default(),
        result_grade: result_unit.and_then(|u| u.grade.clone()),
        craftable: materials_ok && gold_ok.unwrap_or(true) && wood_ok.unwrap_or(true),
        materials_ok,
        missing,
        have,
        need,
        gold: r.gold,
        wood: r.wood,
        wood_incremental: r.wood_incremental,
        gold_ok,
        wood_ok,
        items: r.items.clone(),
        conditions: r.conditions.clone(),
    }
    .with_db(db)
}

impl ComboStatus {
    fn with_db(self, _db: &Database) -> Self {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Database {
        Database::from_json(include_str!("../../../data/ord-2.323.json")).expect("ord-2.323.json")
    }

    fn owned(pairs: &[(&str, u32)]) -> BTreeMap<String, u32> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    fn find<'a>(r: &'a [ComboStatus], result: &str) -> &'a ComboStatus {
        r.iter().find(|c| c.result == result).expect("결과 유닛의 조합식")
    }

    #[test]
    fn nami_plus_sanji_makes_robin() {
        // 니코 로빈(안흔함) = 나미(흔함) + 상디(흔함)
        let r = evaluate(&db(), &owned(&[("h001", 1), ("h004", 1)]), None, None);
        let robin = find(&r, "h00O");
        assert!(robin.craftable);
        assert_eq!(robin.result_name, "니코 로빈");
        assert_eq!(robin.result_grade.as_deref(), Some("안흔함"));
        assert_eq!(r[0].result, "h00O", "조합 가능이 맨 앞");
    }

    #[test]
    fn reports_missing_with_counts() {
        // 후쿠로(안흔함) = 해군 칼병(흔함) ×2
        let r = evaluate(&db(), &owned(&[("h006", 1)]), None, None);
        let fukuro = find(&r, "h00A");
        assert!(!fukuro.craftable);
        assert_eq!(fukuro.missing, vec![Ingredient { unit: "h006".into(), count: 1 }]);
        assert_eq!((fukuro.have, fukuro.need), (1, 2));
    }

    #[test]
    fn skin_variant_counts_as_base_unit() {
        let d = db();
        // H0A5 (여름휴가 타시기) 는 H05N (타시기 - 초월) 의 스킨
        let n = normalize_owned(&d, &owned(&[("H0A5", 1), ("H05N", 1)]));
        assert_eq!(n.len(), 1);
        assert_eq!((n[0].id.as_str(), n[0].count), ("H05N", 2));
    }

    #[test]
    fn summons_are_ignored_and_unknown_codes_kept() {
        let d = db();
        let n = normalize_owned(&d, &owned(&[("h04T", 3), ("zzzz", 1)]));
        assert_eq!(n.len(), 1);
        assert_eq!(n[0].id, "zzzz");
        assert!(!n[0].known);
    }

    #[test]
    fn gold_and_wood_gate_craftable_when_known() {
        let d = db();
        // 골.D.로져(불멸) = 에이스(전설) + 센고쿠(전설) + 스모커(전설), 목재 10
        let recipe = d.recipes.iter().find(|r| d.unit(&r.result).map(|u| u.name == "골.D.로져").unwrap_or(false)).unwrap();
        let mats: Vec<(&str, u32)> = recipe.materials.iter().map(|m| (m.unit.as_str(), m.count)).collect();
        let with = evaluate(&d, &owned(&mats), Some(0), Some(10));
        let without = evaluate(&d, &owned(&mats), Some(0), Some(9));
        assert!(find(&with, &recipe.result).craftable);
        assert!(!find(&without, &recipe.result).craftable);
        assert!(find(&without, &recipe.result).materials_ok);
    }

    #[test]
    fn bundled_database_is_valid() {
        let d = db();
        let problems = d.validate();
        assert!(problems.is_empty(), "{problems:#?}");
        assert!(d.units.len() > 300 && d.recipes.len() > 200);
    }
}

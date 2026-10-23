use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};

/// 조합 데이터베이스. data/recipes.json 의 스키마.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Database {
    /// 대응하는 맵 버전 (예: "2.323")
    pub version: String,
    pub units: Vec<Unit>,
    pub recipes: Vec<Recipe>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Unit {
    /// 워크3 오브젝트 rawcode (4글자). TMO.GG API 와의 조인 키.
    pub id: String,
    pub name: String,
    pub tier: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Recipe {
    /// 결과 유닛 rawcode
    pub result: String,
    pub inputs: Vec<Ingredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Ingredient {
    pub unit: String,
    pub count: u32,
}

/// 내보내기 스크립트(scripts/ord-export.lua)가 쓰는 state.json 의 스키마.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct GameState {
    /// 스키마 버전
    pub v: u32,
    /// 스크립트 기준 경과 시간(초)
    pub t: f64,
    #[serde(default)]
    pub map: String,
    pub player: i32,
    pub gold: i64,
    /// rawcode -> 보유 수
    #[serde(default)]
    pub units: BTreeMap<String, u32>,
}

impl Database {
    pub fn from_json(text: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(text)
    }

    pub fn unit(&self, id: &str) -> Option<&Unit> {
        self.units.iter().find(|u| u.id == id)
    }

    /// 정합성 검사. 발견한 문제 목록을 돌려주며, 비어 있으면 정상이다.
    pub fn validate(&self) -> Vec<String> {
        let mut problems = Vec::new();
        let mut seen = HashSet::new();
        for u in &self.units {
            if u.id.chars().count() != 4 {
                problems.push(format!("유닛 '{}' 의 id 가 4글자가 아님: {}", u.name, u.id));
            }
            if !seen.insert(u.id.as_str()) {
                problems.push(format!("유닛 id 중복: {}", u.id));
            }
        }
        for r in &self.recipes {
            if self.unit(&r.result).is_none() {
                problems.push(format!("조합 결과 {} 가 유닛 목록에 없음", r.result));
            }
            if r.inputs.is_empty() {
                problems.push(format!("조합 {} 의 재료가 비어 있음", r.result));
            }
            for i in &r.inputs {
                if self.unit(&i.unit).is_none() {
                    problems.push(format!("조합 {} 의 재료 {} 가 유닛 목록에 없음", r.result, i.unit));
                }
                if i.count == 0 {
                    problems.push(format!("조합 {} 의 재료 {} 수량이 0", r.result, i.unit));
                }
            }
        }
        problems
    }
}

impl GameState {
    pub fn from_json(text: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(text)
    }
}

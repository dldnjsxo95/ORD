use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

/// 조합 데이터베이스. tools/map-extract/extract.mjs 가 맵에서 뽑은 data/ord-<버전>.json 의 스키마.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Database {
    /// 예: "ORDR_S2_2.323"
    pub version: String,
    #[serde(default)]
    pub extracted_at: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    /// 등급 표기 순서 (낮은 것부터)
    #[serde(default)]
    pub grades: Vec<String>,
    pub units: Vec<Unit>,
    pub recipes: Vec<Recipe>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Unit {
    /// 워크3 오브젝트 rawcode (4글자). TMO.GG API 와의 조인 키.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub grade: Option<String>,
    /// 영웅 칭호 (예: 타시기의 "해군의 홍일점")
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub level: Option<u32>,
    #[serde(default)]
    pub attack: Option<Attack>,
    /// 스킬 툴팁에서 추정한 피해 유형: "물리" | "마법" | "혼합". 휴리스틱.
    #[serde(default)]
    pub damage_hint: Option<String>,
    /// 물딜/마딜 분류 ("물딜" | "마딜"). 다수결 + data/overrides.json 보정. 미분류는 None.
    #[serde(default)]
    pub damage_type: Option<String>,
    /// 스턴 유닛 표시 (overrides 로 확정)
    #[serde(default)]
    pub stun: bool,
    /// 능력치 태그 (스킬 툴팁 키워드, 휴리스틱). 화면 필터 라벨과 같다.
    #[serde(default)]
    pub tags: Vec<String>,
    /// 짧은 스탯 요약 (예: "방깎20, 공증30")
    #[serde(default)]
    pub stat_text: Option<String>,
    /// 역할 배지: flag | sword | heart | plus
    #[serde(default)]
    pub badges: Vec<String>,
    /// 스킨·변형 유닛이면 기본 유닛 id. 보유 수를 셀 때 기본 유닛으로 합산한다.
    #[serde(default)]
    pub base_form: Option<String>,
    /// 스킬이 만드는 분신. 보유 유닛 집계에서 제외한다.
    #[serde(default)]
    pub summon: bool,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub skills: Vec<Skill>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Attack {
    /// normal / pierce / siege / magic / chaos / hero
    #[serde(rename = "type")]
    pub kind: String,
    pub base: i64,
    pub dice: u32,
    pub sides: u32,
    pub range: u32,
    pub cooldown: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub tip: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RecipeKind {
    #[default]
    Craft,
    /// 특수 유닛: 뽑기 전용, 조합 불가
    Special,
    /// 랜덤전용 유닛: 조합 불가
    RandomOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    /// 조합 어빌리티 id (예: "A00D") 또는 내부 코드 (예: "TR03")
    pub id: String,
    /// 결과 유닛 rawcode
    pub result: String,
    #[serde(default)]
    pub kind: RecipeKind,
    #[serde(default)]
    pub materials: Vec<Ingredient>,
    #[serde(default)]
    pub gold: i64,
    #[serde(default)]
    pub wood: i64,
    /// 조합할 때마다 늘어나는 목재 비용의 기본값 (왜곡 유닛)
    #[serde(default)]
    pub wood_incremental: i64,
    /// 기록지침 아이템 요구
    #[serde(default)]
    pub items: Vec<ItemReq>,
    /// 수량으로 판정할 수 없는 조건들 (특성포인트, 라운드 제한, 플레이어당 1기 등)
    #[serde(default)]
    pub conditions: Vec<Condition>,
    /// 이 결과 유닛을 재료로 쓰는 상위 유닛들 (표시용)
    #[serde(default)]
    pub upper_units: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Ingredient {
    pub unit: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ItemReq {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    /// change_count | skill_points | round_max | random_pick | greenblood | unique | king | (기타 원본 코드)
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub value: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
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
    /// 목재. 구버전 스크립트 출력에는 없을 수 있다.
    #[serde(default)]
    pub wood: Option<i64>,
    /// rawcode -> 보유 수 (변형·분신 정리 전의 원본)
    #[serde(default)]
    pub units: BTreeMap<String, u32>,
    /// 기록지침(아이템) 코드(AI00 등) -> 보유(1). 플레이어 어빌리티 또는 인벤토리 아이템으로 감지
    #[serde(default)]
    pub items: BTreeMap<String, u32>,
    /// 진화체 유닛 typeId (시작 위치의 중립 유닛). 없으면 None
    #[serde(default)]
    pub evolution: Option<String>,
    /// rawcode -> 게임 내 이름 (DB 에 없는 코드를 확인하는 용도)
    #[serde(default)]
    pub names: BTreeMap<String, String>,
}

impl Database {
    pub fn from_json(text: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(text)
    }

    pub fn unit(&self, id: &str) -> Option<&Unit> {
        self.units.iter().find(|u| u.id == id)
    }

    /// id -> Unit 색인. 반복 조회 전에 한 번 만든다.
    pub fn index(&self) -> HashMap<&str, &Unit> {
        self.units.iter().map(|u| (u.id.as_str(), u)).collect()
    }

    /// 등급 순서 (모르는 등급은 맨 뒤)
    pub fn grade_rank(&self, grade: Option<&str>) -> usize {
        grade.and_then(|g| self.grades.iter().position(|x| x == g)).unwrap_or(usize::MAX)
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
            if let Some(b) = &u.base_form
                && !self.units.iter().any(|x| &x.id == b)
            {
                problems.push(format!("유닛 {} 의 기본 유닛 {} 이 목록에 없음", u.id, b));
            }
        }
        let mut recipe_ids = HashSet::new();
        for r in &self.recipes {
            if !recipe_ids.insert(r.id.as_str()) {
                problems.push(format!("조합식 id 중복: {}", r.id));
            }
            if self.unit(&r.result).is_none() {
                problems.push(format!("조합 {} 의 결과 {} 가 유닛 목록에 없음", r.id, r.result));
            }
            if r.kind == RecipeKind::Craft && r.materials.is_empty() {
                problems.push(format!("조합 {} 의 재료가 비어 있음", r.id));
            }
            for i in &r.materials {
                if self.unit(&i.unit).is_none() {
                    problems.push(format!("조합 {} 의 재료 {} 가 유닛 목록에 없음", r.id, i.unit));
                }
                if i.count == 0 {
                    problems.push(format!("조합 {} 의 재료 {} 수량이 0", r.id, i.unit));
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

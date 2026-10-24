// 맵 스크립트의 유틸리티 합계 코드(디버프 중첩 테이블)에서 "유닛 → 중첩 그룹"을 뽑아 data/stack-groups.json 으로 쓴다.
// 게임은 같은 그룹(버프 id)의 효과를 하나(큰 값)만 인정한다. 라벨: 방어력 감소(오라 깍), 이동속도 감소(오라 이감), 발동방어력 감소, 발동이동속도 감소.
// 사용: node tools/map-extract/stack-groups.mjs <war3map.j 경로>   (war3map.j 는 맵에서 extractFile('war3map.j') 로 꺼낸 것)
import { readFileSync, writeFileSync } from 'node:fs';

const jPath = process.argv[2];
if (!jPath) throw new Error('war3map.j 경로를 주세요');
const j = readFileSync(jPath, 'utf-8');
const db = JSON.parse(readFileSync('data/ord-2.323.json', 'utf-8'));

const code = (s) => {
  const n = s.startsWith('$') ? parseInt(s.slice(1), 16) : Number(s);
  if (n === 0) return null;
  return String.fromCharCode(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
};
const LABEL = { 1: '방어력 감소', 2: '이동속도 감소', 3: '발동이동속도 감소', 4: '발동방어력 감소' };

// 어빌리티 id → 그룹 (Mf 가 0 이면 어빌리티 자신이 그룹)
const groupOfAbility = {};
for (const m of j.matchAll(/call BH9\(([^,]+),([^,]+),(\d),(\d+),(-?[\d.]+)\)/g)) {
  if (m[1] === 'Me') continue;
  const ab = code(m[1]);
  const grp = code(m[2]) ?? ab;
  (groupOfAbility[m[3]] ??= {})[ab] = grp;
}
for (const m of j.matchAll(/call BIB\(([^,]+),([^,]+),(\d),(\d+),(-?[\d.]+),(-?[\d.]+)\)/g)) {
  const ab = code(m[1]);
  const grp = code(m[2]) ?? ab;
  (groupOfAbility[m[3]] ??= {})[ab] = grp;
}

// 유닛 → 라벨별 그룹 목록 (유닛이 가진 어빌리티로 연결)
const units = {};
for (const u of db.units) {
  for (const s of u.skills) {
    for (const [cat, map] of Object.entries(groupOfAbility)) {
      const grp = map[s.id];
      if (!grp) continue;
      const label = LABEL[cat];
      const set = ((units[u.id] ??= {})[label] ??= []);
      if (!set.includes(grp)) set.push(grp);
    }
  }
}
const out = {
  _doc: '맵 스크립트 중첩 테이블 → 유닛별 그룹. 같은 라벨에서 같은 그룹인 유닛들은 게임이 하나(큰 값)만 인정한다. 표에 없는 유닛은 자기 혼자 그룹.',
  source: jPath.split(/[/]/).pop().split(String.fromCharCode(92)).pop(),
  extractedAt: new Date().toISOString(),
  units,
};
writeFileSync('data/stack-groups.json', JSON.stringify(out, null, 1) + '\n');
const n = Object.keys(units).length;
console.log(`유닛 ${n}기 → data/stack-groups.json`);

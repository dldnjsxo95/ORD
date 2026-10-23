// 원랜디R 맵(w3x2lni 최적화 구조)에서 유닛·조합식·스킬 데이터를 뽑아 JSON 과 마크다운으로 쓴다.
//
// 사용: node tools/map-extract/extract.mjs "maps/ORDR_S2_2.323[C].w3x"
// 출력: data/ord-2.323.json, docs/03-research/ord-2.323-조합표.md
//
// 맵 구조 (2026-10-23 분석):
// - Units\CampaignUnitStrings.txt : [rawcode] Name / Propernames / Art. 이름은 "캐릭터 - 등급" 꼴 (영웅은 Propernames 에).
// - Units\CampaignAbilityStrings.txt : 스킬 이름·툴팁. [조합] 어빌리티 툴팁에는 조합식이 사람이 읽는 형태로 있음.
// - Units\UnitWeapons.slk / UnitBalance.slk / UnitAbilities.slk : 공격, 레벨, 보유 어빌리티.
// - war3map.j 의 CWR 함수 : 조합 테이블. BGG(어빌리티) 로 레시피 시작, BGH('UNIT', 결과, 1), BGI(종류, 값, 수량).
//   종류: UNIT 재료 / UPUN 상위 유닛 링크(요구사항 아님) / WOOD 목재 / GOLD 골드 / IFCT 증가형 목재 / ITEM 기록지침 아이템(AI0x)
//         CHCT 변화가능 횟수 / SKPT 특성포인트 / RMAX N라운드까지만 / PICK 랜덤전용 유닛 1기 / GREN 기록지침 [그린블러드]
//         UBAN·KING 결과 유닛 자신을 가리킴(제한·신비 유닛, 플레이어당 1기로 해석) / SPEC·RDUN 특수·랜덤전용(조합 불가 마커)
// - war3map.j 의 SaveInteger(J5, A, 0, B) : 변형 유닛 A → 기본 유닛 B.
// - war3map.j 의 Bi9(유닛, "검색어") : 검색 별칭.
import { MpqArchive } from 'stormlib-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const mapPath = process.argv[2];
if (!mapPath) throw new Error('맵 경로를 주세요');
const VERSION = (mapPath.match(/(\d+\.\d+)/) ?? [])[1] ?? 'unknown';

const archive = MpqArchive.openFromBuffer(readFileSync(mapPath));
const read = (name) => archive.extractFile(name).toString('utf-8').replace(/\r\n?/g, '\n');
const unitStrings = parseIni(read('Units\\CampaignUnitStrings.txt'));
const abilStrings = parseIni(read('Units\\CampaignAbilityStrings.txt'));
const weapons = parseSlk(read('Units\\UnitWeapons.slk'));
const balance = parseSlk(read('Units\\UnitBalance.slk'));
const unitAbils = parseSlk(read('Units\\UnitAbilities.slk'));
const script = read('war3map.j');
archive.close();

// ── 파서 ────────────────────────────────────────────────────────────────
function parseIni(text) {
  const out = {};
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const sec = raw.match(/^\[([A-Za-z0-9]{4})\]\s*$/);
    if (sec) { cur = out[sec[1]] = {}; continue; }
    const eq = raw.indexOf('=');
    if (cur && eq > 0) cur[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }
  return out;
}
function parseSlk(text) {
  const cols = {};
  const rows = {};
  let y = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^C;X(\d+)(?:;Y(\d+))?;K(.*)$/);
    if (!m) continue;
    const x = Number(m[1]);
    if (m[2]) y = Number(m[2]);
    const v = m[3].replace(/^"|"$/g, '');
    if (y === 1) cols[x] = v;
    else (rows[y] ??= {})[x] = v;
  }
  const out = {};
  for (const r of Object.values(rows)) {
    const d = {};
    for (const [x, v] of Object.entries(r)) d[cols[x] ?? x] = v;
    const key = d[cols[1]];
    if (key) out[key] = d;
  }
  return out;
}
const rc = (hex) => Buffer.from(hex, 'hex').toString('latin1');
const strip = (s) => (s ?? '').replace(/\|[cC][0-9a-fA-F]{8}|\|r/g, '').replace(/\|n/g, '\n').trim();

// ── 유닛 ────────────────────────────────────────────────────────────────
const GRADES = ['흔함', '안흔함', '특별', '희귀', '전설', '히든', '변화', '제한', '랜덤전용', '신비', '초월', '불멸', '영원', '왜곡', '특수', '세라핌', '오로성'];
function parseName(id) {
  const s = unitStrings[id] ?? {};
  const proper = strip(s.Propernames);
  const name = strip(s.Name);
  for (const cand of [proper, name]) {
    const m = cand.match(/^(.*?)\s*-\s*([가-힣]+)\s*$/);
    if (m && GRADES.includes(m[2])) return { name: m[1].trim(), grade: m[2], title: cand === proper ? name : null };
  }
  return { name: proper || name || id, grade: null, title: proper && name && proper !== name ? name : null };
}

// ── 조합 테이블 (CWR) ──────────────────────────────────────────────────
// 함수 이름은 난독화되어 버전마다 바뀔 수 있으므로, BGG 호출이 가장 많은 함수를 조합 테이블로 본다.
let cwr = null;
let best = 0;
for (const m of script.matchAll(/^function (\w+) takes nothing returns nothing\n([\s\S]*?)^endfunction/gm)) {
  const n = (m[2].match(/^call BGG\(/gm) ?? []).length;
  if (n > best) { best = n; cwr = m[2]; }
}
if (!cwr || best < 10) throw new Error('조합 테이블 함수를 찾지 못함 (맵 구조가 바뀌었을 수 있음)');
const recipes = [];
let cur = null;
for (const line of cwr.split('\n')) {
  const g = line.match(/^call BGG\(\$([0-9A-F]{8})\)/);
  const h = line.match(/^call BG([HI])\(\$([0-9A-F]{8}),\$([0-9A-F]{8}),(\d+)\)/);
  if (g) { cur = { id: rc(g[1]), result: null, entries: [] }; recipes.push(cur); }
  else if (h) {
    const e = { kind: rc(h[2]), value: rc(h[3]), count: Number(h[4]) };
    if (h[1] === 'H') cur.result = e.value; else cur.entries.push(e);
  }
}

const COND = { CHCT: 'change_count', SKPT: 'skill_points', RMAX: 'round_max', PICK: 'random_pick', GREN: 'greenblood', UBAN: 'unique', KING: 'king' };
const outRecipes = recipes.map((r) => {
  const o = { id: r.id, result: r.result, kind: 'craft', materials: [], gold: 0, wood: 0, woodIncremental: 0, items: [], conditions: [], upperUnits: [] };
  for (const e of r.entries) {
    switch (e.kind) {
      case 'UNIT': o.materials.push({ unit: e.value, count: e.count }); break;
      case 'UPUN': o.upperUnits.push(e.value); break;
      case 'WOOD': o.wood += e.count; break;
      case 'GOLD': o.gold += e.count; break;
      case 'IFCT': o.woodIncremental += e.count; break;
      case 'ITEM': o.items.push({ id: e.value, name: strip(abilStrings[e.value]?.Name) || e.value }); break;
      case 'SPEC': o.kind = 'special'; break;
      case 'RDUN': o.kind = 'random_only'; break;
      default:
        if (COND[e.kind]) o.conditions.push({ type: COND[e.kind], value: e.count });
        else o.conditions.push({ type: e.kind, value: e.count, raw: e.value });
    }
  }
  // 재료 유닛이 하나도 없는 조합식(이벤트 획득, 맵 제작자의 TEST 항목 등)은 조합으로 취급하지 않는다.
  if (o.kind === 'craft' && o.materials.length === 0) o.kind = 'special';
  return o;
});

// ── 변형 매핑, 검색 별칭 ────────────────────────────────────────────────
const baseForm = {};
for (const m of script.matchAll(/call SaveInteger\(J5,\$([0-9A-F]{8}),0,\$([0-9A-F]{8})\)/g)) baseForm[rc(m[1])] = rc(m[2]);
const aliases = {};
for (const m of script.matchAll(/call Bi9\(\$([0-9A-F]{8}),"([^"]*)"\)/g)) (aliases[rc(m[1])] ??= []).push(m[2]);

// ── 유닛 목록 확정: 레시피에 등장하거나 등급이 있거나 변형 매핑에 있는 것 ──
const ids = new Set();
for (const r of outRecipes) { ids.add(r.result); r.materials.forEach((m) => ids.add(m.unit)); r.upperUnits.forEach((u) => ids.add(u)); }
for (const [a, b] of Object.entries(baseForm)) { ids.add(a); ids.add(b); }
for (const id of Object.keys(unitStrings)) if (parseName(id).grade) ids.add(id);

const GENERIC_ABILS = new Set(['Avul', 'AInv', 'Aloc', 'Amov', 'Aatk']);
const units = [...ids].filter((id) => unitStrings[id]).map((id) => {
  const { name, grade, title } = parseName(id);
  const w = weapons[id] ?? {};
  const b = balance[id] ?? {};
  const abilList = (unitAbils[id]?.abilList ?? '').split(',').map((s) => s.trim()).filter((a) => a && !GENERIC_ABILS.has(a));
  const skills = abilList
    // 스킬 이름의 내부 접두어("!0720_박무" → "박무")는 뗀다.
    .map((a) => ({ id: a, name: strip(abilStrings[a]?.Name).replace(/^!\d+_/, ''), tip: strip(abilStrings[a]?.Ubertip) }))
    .filter((s) => s.name && s.tip && s.tip !== ',' && !s.name.startsWith('[조합]'));
  const text = skills.map((s) => s.tip).join('\n');
  const phys = (text.match(/물리/g) ?? []).length;
  const magic = (text.match(/마법/g) ?? []).length;
  const damageHint = phys && magic ? '혼합' : phys ? '물리' : magic ? '마법' : null;
  return {
    id, name, grade, title: title || undefined,
    icon: unitStrings[id].Art || undefined,
    level: Number(b.level) || undefined,
    attack: w.atkType1 ? {
      type: w.atkType1, base: Number(w.dmgplus1) || 0, dice: Number(w.dice1) || 0, sides: Number(w.sides1) || 0,
      range: Number(w.rangeN1) || 0, cooldown: Number(w.cool1) || 0,
    } : undefined,
    damageHint: damageHint || undefined,
    baseForm: baseForm[id],
    aliases: aliases[id],
    skills,
  };
}).sort((a, b) => (GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade)) || a.id.localeCompare(b.id));

// ── 분신(소환물) 표시: 등급 표기는 있지만 어떤 조합에도 안 쓰이고 변형 매핑도 없고 스킬도 없는 유닛 ──
const involved = new Set();
for (const r of outRecipes) { involved.add(r.result); r.materials.forEach((m) => involved.add(m.unit)); r.upperUnits.forEach((u) => involved.add(u)); }
for (const [a, b] of Object.entries(baseForm)) { involved.add(a); involved.add(b); }
for (const u of units) if (u.grade && !involved.has(u.id) && u.skills.length === 0) u.summon = true;

// ── 정합성 ──────────────────────────────────────────────────────────────
const known = new Set(units.map((u) => u.id));
const problems = [];
for (const r of outRecipes) {
  if (!known.has(r.result)) problems.push(`레시피 ${r.id} 결과 ${r.result} 이름 없음`);
  for (const m of r.materials) if (!known.has(m.unit)) problems.push(`레시피 ${r.id} 재료 ${m.unit} 이름 없음`);
}

const db = {
  version: `ORDR_S2_${VERSION}`,
  extractedAt: new Date().toISOString(),
  source: mapPath.replace(/\\/g, '/').split('/').pop(),
  grades: GRADES,
  units,
  recipes: outRecipes,
};
mkdirSync('data', { recursive: true });
writeFileSync(`data/ord-${VERSION}.json`, JSON.stringify(db, null, 1) + '\n', 'utf-8');

// ── 사람이 읽는 조합표 ──────────────────────────────────────────────────
const byId = Object.fromEntries(units.map((u) => [u.id, u]));
const label = (id) => { const u = byId[id]; return u ? (u.grade ? `${u.name}(${u.grade})` : u.name) : id; };
const condText = (c) => ({
  change_count: `변화가능 횟수 ${c.value}`, skill_points: `특성포인트 ${c.value}`, round_max: `${c.value}라운드까지만`,
  random_pick: `랜덤전용 유닛 ${c.value}기`, greenblood: '기록지침 [그린블러드]', unique: '플레이어당 1기', king: 'KING',
}[c.type] ?? `${c.type} ${c.value}`);
let md = `# 원랜디R ${VERSION} 조합표\n\n맵 파일에서 자동 추출 (${db.extractedAt.slice(0, 10)}). 유닛 ${units.length}종, 조합식 ${outRecipes.length}개.\n`;
md += `UPUN(상위 유닛 링크)은 요구사항이 아니라 표시용이라 생략. UBAN/KING 은 결과 유닛 자신을 가리켜 "플레이어당 1기"로 해석함.\n\n`;
md += `## 등급별 유닛 수\n\n| 등급 | 수 |\n|---|---|\n`;
for (const g of GRADES) { const n = units.filter((u) => u.grade === g).length; if (n) md += `| ${g} | ${n} |\n`; }
md += `\n## 조합식\n\n| 결과 | 재료 | 비용 | 조건 |\n|---|---|---|---|\n`;
for (const r of outRecipes.filter((r) => r.kind === 'craft')) {
  const mats = r.materials.map((m) => label(m.unit) + (m.count > 1 ? ` ×${m.count}` : '')).join(', ');
  const cost = [r.gold && `${r.gold}골드`, r.wood && `목재 ${r.wood}`, r.woodIncremental && `목재 ${r.woodIncremental}+증가`, ...r.items.map((i) => `아이템 ${i.name}`)].filter(Boolean).join(', ');
  md += `| **${label(r.result)}** | ${mats || '-'} | ${cost || '-'} | ${r.conditions.map(condText).join(', ') || '-'} |\n`;
}
md += `\n## 조합 불가 (특수·랜덤전용)\n\n`;
for (const r of outRecipes.filter((r) => r.kind !== 'craft')) md += `- ${label(r.result)} — ${r.kind === 'special' ? '특수(뽑기 전용)' : '랜덤전용'}\n`;
md += `\n## 변형 유닛 → 기본 유닛\n\n`;
for (const [a, b] of Object.entries(baseForm)) md += `- ${label(a)} (${a}) → ${label(b)} (${b})\n`;
mkdirSync('docs/03-research', { recursive: true });
writeFileSync(`docs/03-research/ord-${VERSION}-조합표.md`, md, 'utf-8');

// ── 요약 ────────────────────────────────────────────────────────────────
const gradeCount = Object.fromEntries(GRADES.map((g) => [g, units.filter((u) => u.grade === g).length]));
console.log(`버전 ${db.version} | 유닛 ${units.length} | 레시피 ${outRecipes.length} (craft ${outRecipes.filter((r) => r.kind === 'craft').length}) | 변형 ${Object.keys(baseForm).length}`);
console.log('등급별:', JSON.stringify(gradeCount));
console.log('피해 유형 힌트:', JSON.stringify(units.reduce((a, u) => ((a[u.damageHint ?? '없음'] = (a[u.damageHint ?? '없음'] ?? 0) + 1), a), {})));
console.log('등급 없는 유닛:', units.filter((u) => !u.grade).map((u) => `${u.id}:${u.name}`).join(', '));
console.log('분신(summon) 표시:', units.filter((u) => u.summon).length, '종');
console.log(problems.length ? `문제 ${problems.length}건:\n  ${problems.join('\n  ')}` : '정합성 문제 없음');

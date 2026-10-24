// 맵에서 유닛별 공격속도 업그레이드(기본 증가량·레벨당 증가폭·최대 레벨)와 마나/체력 회복을 뽑아 data/upgrades.json 으로 쓴다.
// 사용: node tools/map-extract/upgrades.mjs "maps/ORDR_S2_2.323[C].w3x"
// 출처: Units\UpgradeData.slk (rats = 공격속도 보너스, 레벨 n 값 = base + mod×(n−1)), Units\UnitBalance.slk (upgrades, regenMana, regenHP),
//       Units\UnitWeapons.slk (cool1), Units\CampaignUpgradeStrings.txt (업그레이드 이름).
import { MpqArchive } from 'stormlib-js';
import { readFileSync, writeFileSync } from 'node:fs';

const mapPath = process.argv[2];
if (!mapPath) throw new Error('맵 경로를 주세요');
const archive = MpqArchive.openFromBuffer(readFileSync(mapPath));
const read = (name) => archive.extractFile(name).toString('latin1');
const readUtf8 = (name) => archive.extractFile(name).toString('utf-8');
const upg = parseSlk(read('Units\\UpgradeData.slk'), 'upgradeid');
const bal = parseSlk(read('Units\\UnitBalance.slk'), 'unitBalanceID');
const wep = parseSlk(read('Units\\UnitWeapons.slk'), 'unitWeapID');
const names = parseIni(readUtf8('Units\\CampaignUpgradeStrings.txt'));
archive.close();

function parseSlk(text, idCol) {
  const cols = {}, rows = {}; let y = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^C;X(\d+)(?:;Y(\d+))?;K(.*)$/); if (!m) continue;
    const x = Number(m[1]); if (m[2]) y = Number(m[2]);
    const v = m[3].replace(/^"|"$/g, '');
    if (y === 1) cols[x] = v; else (rows[y] ??= {})[x] = v;
  }
  const out = {};
  for (const r of Object.values(rows)) { const o = {}; for (const [x, v] of Object.entries(r)) o[cols[x]] = v; if (o[idCol]) out[o[idCol]] = o; }
  return out;
}
function parseIni(text) {
  const out = {}; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const sec = raw.match(/^\[([A-Za-z0-9]{4})\]\s*$/); if (sec) { cur = out[sec[1]] = {}; continue; }
    const eq = raw.indexOf('='); if (cur && eq > 0) cur[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }
  return out;
}
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(/\.$/, '')));

/** 업그레이드 id → 공격속도 효과 { base(%), inc(%), max } (rats 효과가 없으면 null) */
const upgrades = {};
for (const [id, o] of Object.entries(upg)) {
  if (!/^R/.test(id)) continue;
  let speed = null;
  for (const i of [1, 2, 3, 4]) if (o['effect' + i] === 'rats') speed = { base: Math.round(num(o['base' + i]) * 10000) / 100, inc: Math.round(num(o['mod' + i]) * 10000) / 100 };
  if (!speed) continue;
  upgrades[id] = { name: (names[id]?.Name ?? '').replace(/^"|"$/g, '').split(',')[0], max: num(o.maxlevel) ?? 1, ...speed };
}

/** 유닛 id → 공격속도 업그레이드 + 회복 */
const units = {};
for (const [id, b] of Object.entries(bal)) {
  if (!/^[hHoOeEuUnN]/.test(id)) continue;
  const list = String(b.upgrades ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const speedId = list.find((u) => upgrades[u]);
  const w = wep[id] ?? {};
  units[id] = {
    upgrade: speedId ?? null,
    cooldown: num(w.cool1),
    regenMana: num(b.regenMana) ?? 0,
    regenHP: num(b.regenHP) ?? 0,
    mana: num(b.manaN) ?? 0,
    hp: num(b.HP) ?? 0,
  };
}
const out = {
  _doc: '맵에서 추출한 유닛별 공격속도 업그레이드와 회복량. upgrades[id]: 레벨 n 공속 보너스(%) = base + inc×(n−1), 최대 max. units[id].upgrade 가 그 유닛의 공속 업그레이드 id.',
  source: mapPath.replace(/\\/g, '/').split('/').pop(),
  extractedAt: new Date().toISOString(),
  upgrades,
  units,
};
writeFileSync('data/upgrades.json', JSON.stringify(out, null, 1) + '\n');
console.log(`업그레이드 ${Object.keys(upgrades).length}개, 유닛 ${Object.keys(units).length}기 → data/upgrades.json`);

// 맵 MPQ 안에 어떤 파일이 있는지 조사하고, 데이터 추출에 필요한 파일을 maps/extract/ 로 꺼낸다.
// 사용: node tools/map-extract/probe.mjs "maps/ORDR_S2_2.323[C].w3x"
import { MpqArchive } from 'stormlib-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mapPath = process.argv[2];
if (!mapPath) throw new Error('맵 경로를 주세요');
const outDir = join('maps', 'extract');
mkdirSync(outDir, { recursive: true });

// ESM 빌드의 MpqArchive.open 은 fs 동적 require 문제가 있어 버퍼로 연다.
const archive = MpqArchive.openFromBuffer(readFileSync(mapPath));
const h = archive.getHeader();
console.log('header:', JSON.stringify(h, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

const internal = archive.getFileList();
console.log(`(listfile) 로 알려진 파일: ${internal.length}`);
if (internal.length) console.log(internal.slice(0, 40).join('\n'));

// 보호맵은 listfile 이 없으므로 알려진 이름을 직접 두드린다.
const KNOWN = [
  '(listfile)', '(attributes)', '(signature)',
  'war3map.w3i', 'war3map.wts', 'war3map.j', 'war3map.lua', 'scripts\\war3map.j', 'scripts\\war3map.lua',
  'war3map.w3u', 'war3map.w3t', 'war3map.w3a', 'war3map.w3b', 'war3map.w3d', 'war3map.w3q', 'war3map.w3h',
  'war3map.w3e', 'war3map.wpm', 'war3map.doo', 'war3mapUnits.doo', 'war3map.w3r', 'war3map.w3c', 'war3map.w3s',
  'war3map.wtg', 'war3map.wct', 'war3map.imp', 'war3mapMisc.txt', 'war3mapSkin.txt', 'war3mapExtra.txt',
  'war3mapMap.blp', 'war3mapPreview.tga', 'war3map.mmp', 'war3map.shd', 'war3map.w3f',
  'Units\\UnitFunc.txt', 'Units\\UnitStrings.txt', 'Units\\UnitUI.txt', 'Units\\CommandFunc.txt',
  'Units\\AbilityFunc.txt', 'Units\\AbilityStrings.txt', 'Units\\ItemFunc.txt', 'Units\\ItemStrings.txt',
  'UI\\WorldEditStrings.txt', 'Units\\UnitBalance.slk', 'Units\\UnitData.slk', 'Units\\UnitAbilities.slk',
  'Units\\UnitWeapons.slk', 'Units\\AbilityData.slk', 'Units\\ItemData.slk',
];
// tools/map-extract/names.txt 에 추가 후보 이름을 한 줄씩 둘 수 있다.
let extra = [];
try {
  extra = readFileSync(new URL('./names.txt', import.meta.url), 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
} catch {}
const found = [];
for (const name of [...new Set([...KNOWN, ...extra])]) {
  if (!archive.hasFile(name)) continue;
  try {
    const f = archive.openFile(name);
    const data = f.read();
    f.close();
    found.push({ name, size: data.length });
    writeFileSync(join(outDir, name.replace(/\\/g, '__')), data);
  } catch (e) {
    found.push({ name, size: -1, error: String(e.message ?? e) });
  }
}
console.log('\n알려진 이름으로 찾은 파일:');
for (const f of found) console.log(`  ${f.name.padEnd(32)} ${f.size >= 0 ? f.size + ' bytes' : '오류: ' + f.error}`);

const all = archive.enumerateFiles();
const named = all.filter((e) => !/^File\d+/.test(e.fileName));
console.log(`\n전체 엔트리: ${all.length}, 이름 있는 것: ${named.length}, 이름 없는 것: ${all.length - named.length}`);
archive.close();

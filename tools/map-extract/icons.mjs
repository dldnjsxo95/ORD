// 유닛 초상화(BLP)를 맵에서 꺼내 maps/extract/icons/<id>.blp 로 저장한다. PNG 변환은 icons.py 가 한다.
// 사용: node tools/map-extract/icons.mjs "maps/ORDR_S2_2.323[C].w3x"
import { MpqArchive } from 'stormlib-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const mapPath = process.argv[2];
if (!mapPath) throw new Error('맵 경로를 주세요');
const VERSION = (mapPath.match(/(\d+\.\d+)/) ?? [])[1] ?? 'unknown';
const db = JSON.parse(readFileSync(`data/ord-${VERSION}.json`, 'utf-8'));
const archive = MpqArchive.openFromBuffer(readFileSync(mapPath));
mkdirSync('maps/extract/icons', { recursive: true });

let ok = 0;
const missing = [];
for (const u of db.units) {
  if (!u.icon) { missing.push(u.id); continue; }
  const candidates = [u.icon, u.icon.replace(/\.blp$/i, '') + '.blp', u.icon.replace(/\.blp$/i, '.dds')];
  const found = candidates.find((p) => archive.hasFile(p));
  if (!found) { missing.push(`${u.id}:${u.icon}`); continue; }
  writeFileSync(`maps/extract/icons/${u.id}.${found.split('.').pop().toLowerCase()}`, archive.extractFile(found));
  ok++;
}
archive.close();
console.log(`아이콘 추출 ${ok} / 없음 ${missing.length}`);
if (missing.length) console.log('없음:', missing.join(', '));

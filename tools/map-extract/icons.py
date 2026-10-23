# maps/extract/icons/*.blp 를 static/icons/<id>.png (64x64) 로 변환한다. Pillow 필요.
# 사용: python -I tools/map-extract/icons.py
import io
import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
src = Path("maps/extract/icons")
dst = Path("static/icons")
dst.mkdir(parents=True, exist_ok=True)
ok, bad = 0, []
for f in sorted(src.glob("*.*")):
    try:
        im = Image.open(f)
        im.load()
        im = im.convert("RGBA").resize((64, 64), Image.LANCZOS)
        im.save(dst / f"{f.stem}.png", optimize=True)
        ok += 1
    except Exception as e:  # noqa: BLE001
        bad.append(f"{f.name}: {e}")
print(f"PNG 변환 {ok} / 실패 {len(bad)}")
for b in bad[:10]:
    print("  ", b)

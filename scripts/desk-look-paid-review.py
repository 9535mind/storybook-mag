"""유료 없이 4장 나란히 + 합성 확대. 생성 API 없음."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'tmp-faceswap-test' / 'desk-look-paid-woman-full'
CROP = DIR / 'review-crops'
CROP.mkdir(parents=True, exist_ok=True)

src = Image.open(DIR / '00-source.jpg').convert('RGB')
mask = Image.open(DIR / '01-mask.png').convert('L')
raw = Image.open(DIR / '02-model-raw.png').convert('RGB')
comp = Image.open(DIR / '03-composite.png').convert('RGB')
W, H = src.size
raw = raw.resize((W, H), Image.BILINEAR)
comp = comp.resize((W, H), Image.BILINEAR)
mask = mask.resize((W, H), Image.NEAREST)

ZOOM = [
    ('neck', 0.50, 0.23, 0.14),
    ('armpit-L', 0.41, 0.33, 0.12),
    ('armpit-R', 0.57, 0.33, 0.12),
    ('hand-L', 0.39, 0.55, 0.12),
    ('hand-R', 0.59, 0.55, 0.12),
    ('waist', 0.50, 0.47, 0.16),
    ('jacket-hem', 0.50, 0.53, 0.14),
    ('clothes-edge', 0.44, 0.30, 0.12),
]


def crop_at(im: Image.Image, cx: float, cy: float, side: float) -> Image.Image:
    s = int(side * min(W, H))
    x0 = int(cx * W - s / 2)
    y0 = int(cy * H - s / 2)
    x0 = max(0, min(W - s, x0))
    y0 = max(0, min(H - s, y0))
    return im.crop((x0, y0, x0 + s, y0 + s)).resize((s * 3, s * 3), Image.NEAREST)


def label_bar(text: str, w: int, h: int = 36) -> Image.Image:
    bar = Image.new('RGB', (w, h), (18, 18, 18))
    d = ImageDraw.Draw(bar)
    d.text((10, 8), text, fill=(240, 240, 240))
    return bar


cols = []
for title, im in [
    ('00 source', src),
    ('01 mask (white=edit)', mask.convert('RGB')),
    ('02 model raw', raw),
    ('03 composite = local scene', comp),
]:
    thumb_h = 640
    thumb_w = int(W * thumb_h / H)
    t = im.resize((thumb_w, thumb_h), Image.BILINEAR)
    col = Image.new('RGB', (thumb_w, thumb_h + 36), (0, 0, 0))
    col.paste(label_bar(title, thumb_w), (0, 0))
    col.paste(t, (0, 36))
    cols.append(col)

gap = 12
board_w = sum(c.width for c in cols) + gap * 3
board_h = cols[0].height
top = Image.new('RGB', (board_w, board_h), (8, 8, 8))
x = 0
for c in cols:
    top.paste(c, (x, 0))
    x += c.width + gap

# zoom rows: source | composite | |src-comp| for leftover
rows = []
for name, cx, cy, side in ZOOM:
    a = crop_at(src, cx, cy, side)
    b = crop_at(comp, cx, cy, side)
    aa = np.asarray(a, dtype=np.int16)
    bb = np.asarray(b, dtype=np.int16)
    diff = np.clip(np.abs(aa - bb) * 4, 0, 255).astype(np.uint8)
    diff_im = Image.fromarray(diff)
    cell_w = a.width
    row = Image.new('RGB', (cell_w * 3 + 24, a.height + 36), (8, 8, 8))
    row.paste(label_bar(f'{name}  |  source  |  composite  |  |src-comp| x4', cell_w * 3 + 24), (0, 0))
    row.paste(a, (0, 36))
    row.paste(b, (cell_w + 12, 36))
    row.paste(diff_im, (cell_w * 2 + 24, 36))
    a.save(CROP / f'{name}-source.png')
    b.save(CROP / f'{name}-composite.png')
    diff_im.save(CROP / f'{name}-diff.png')
    rows.append(row)

zoom_h = sum(r.height for r in rows) + gap * (len(rows) - 1)
zoom_w = max(r.width for r in rows)
zoom = Image.new('RGB', (zoom_w, zoom_h), (8, 8, 8))
y = 0
for r in rows:
    zoom.paste(r, (0, y))
    y += r.height + gap

note = label_bar(
    'ArcFace 0.9995 = protected source face on black mask. Not model identity. White MAD 11.65 != silk slip. No extra paid call.',
    max(board_w, zoom_w),
    44,
)
out_w = max(board_w, zoom_w, note.width)
out = Image.new('RGB', (out_w, note.height + 12 + board_h + 16 + zoom_h), (8, 8, 8))
out.paste(note, (0, 0))
out.paste(top, (0, note.height + 12))
out.paste(zoom, (0, note.height + 12 + board_h + 16))
out.save(DIR / 'review-board.png')

src_a = np.asarray(src, dtype=np.int16)
comp_a = np.asarray(comp, dtype=np.int16)
m = np.asarray(mask)
white = m >= 128
black = m < 128
absd = np.abs(src_a - comp_a).mean(axis=2)
facts = {
    'whiteMad': float(absd[white].mean()) if white.any() else 0,
    'blackMad': float(absd[black].mean()) if black.any() else 0,
    'whiteMax': float(absd[white].max()) if white.any() else 0,
    'blackMax': float(absd[black].max()) if black.any() else 0,
    'note': 'ArcFace 0.9995 is protected original face, not model identity generation.',
}
(DIR / 'review-facts.json').write_text(json.dumps(facts, indent=2), encoding='utf8')
print(json.dumps({'ok': True, 'board': str(DIR / 'review-board.png'), **facts}))

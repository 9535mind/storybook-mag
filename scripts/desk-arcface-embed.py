"""CAST 얼굴 → ArcFace 512d. 유료 API 없음. 검출 실패는 즉시 중단."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / 'tmp-faceswap-test' / '_models' / 'buffalo_l'
REC_ONNX = MODEL_DIR / 'w600k_r50.onnx'
HF_REC = 'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx'


def cosine(a, b):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def crop_face(im: Image.Image, box: dict, pad=0.18) -> Image.Image:
    w, h = im.size
    x0 = box['x'] * w
    y0 = box['y'] * h
    bw = box['w'] * w
    bh = box['h'] * h
    cx = x0 + bw / 2
    cy = y0 + bh / 2
    side = max(bw, bh) * (1 + pad * 2)
    left = int(max(0, cx - side / 2))
    top = int(max(0, cy - side / 2))
    right = int(min(w, cx + side / 2))
    bottom = int(min(h, cy + side / 2))
    if right - left < 8 or bottom - top < 8:
        raise RuntimeError('face_crop_too_small')
    return im.crop((left, top, right, bottom)).resize((112, 112), Image.BILINEAR)


def embed_onnx(im112: Image.Image, sess) -> list[float]:
    arr = np.asarray(im112.convert('RGB'), dtype=np.float32)
    arr = (arr - 127.5) / 127.5
    arr = np.transpose(arr, (2, 0, 1))[None, ...]
    inp = sess.get_inputs()[0].name
    out = sess.run(None, {inp: arr})[0][0]
    out = out.astype(np.float32)
    n = np.linalg.norm(out)
    if n == 0:
        raise RuntimeError('embedding_zero')
    return (out / n).tolist()


def ensure_rec_model():
    if REC_ONNX.exists() and REC_ONNX.stat().st_size > 1_000_000:
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    import urllib.request
    urllib.request.urlretrieve(HF_REC, REC_ONNX)


def embed_insightface(path: str, boxes: list[dict]):
    import contextlib
    import io
    import cv2
    from insightface.app import FaceAnalysis

    sink = io.StringIO()
    with contextlib.redirect_stdout(sink):
        app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(640, 640))
    img = cv2.imread(path)
    if img is None:
        raise RuntimeError('image_read_failed')
    with contextlib.redirect_stdout(sink):
        faces = app.get(img)
    if not faces:
        return None, 'undetected'
    h, w = img.shape[:2]
    remaining = list(faces)
    out = []
    for box in boxes:
        cx = (box['x'] + box['w'] / 2) * w
        cy = (box['y'] + box['h'] / 2) * h
        hit = None
        hit_i = -1
        best = 1e9
        for i, f in enumerate(remaining):
            fx = (f.bbox[0] + f.bbox[2]) / 2
            fy = (f.bbox[1] + f.bbox[3]) / 2
            d = (fx - cx) ** 2 + (fy - cy) ** 2
            if d < best:
                best = d
                hit = f
                hit_i = i
        limit = (max(box['w'], box['h']) * max(w, h) * 0.85) ** 2
        if hit is None or hit_i < 0 or best > limit:
            return None, 'undetected'
        vec = hit.normed_embedding
        if vec is None:
            return None, 'embedding_failed'
        remaining.pop(hit_i)
        out.append({'slot': box.get('slot', ''), 'dim': int(len(vec)), 'vec': vec.astype(float).tolist()})
    return out, 'insightface-buffalo_l'


def embed_crop(path: str, boxes: list[dict]):
    import onnxruntime as ort

    ensure_rec_model()
    sess = ort.InferenceSession(str(REC_ONNX), providers=['CPUExecutionProvider'])
    im = Image.open(path).convert('RGB')
    out = []
    for box in boxes:
        crop = crop_face(im, box)
        vec = embed_onnx(crop, sess)
        out.append({'slot': box.get('slot', ''), 'dim': len(vec), 'vec': vec})
    return out, 'arcface-w600k_r50-crop'


def main():
    job = json.loads(sys.stdin.read())
    path = job['image']
    boxes = job['faces']
    try:
        vecs, engine = embed_insightface(path, boxes)
        if vecs is None:
            print(json.dumps({'ok': False, 'engine': engine, 'error': engine, 'faces': []}))
            return
        print(json.dumps({'ok': True, 'engine': engine, 'faces': vecs}))
    except Exception as err:
        print(json.dumps({'ok': False, 'engine': 'failed', 'error': str(err), 'faces': []}))


if __name__ == '__main__':
    main()

"""SegFormer-b2-clothes 로컬 파싱. 유료 이미지 생성 API 없음."""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / 'tmp-faceswap-test' / '_models' / 'segformer_b2_clothes'
ONNX = MODEL_DIR / 'model_quantized.onnx'
HF_ONNX = 'https://huggingface.co/Xenova/segformer_b2_clothes/resolve/main/onnx/model_quantized.onnx'

ID2LABEL = [
    'Background',
    'Hat',
    'Hair',
    'Sunglasses',
    'Upper-clothes',
    'Skirt',
    'Pants',
    'Dress',
    'Belt',
    'Left-shoe',
    'Right-shoe',
    'Face',
    'Left-leg',
    'Right-leg',
    'Left-arm',
    'Right-arm',
    'Bag',
    'Scarf',
]
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def ensure_model():
    if ONNX.exists() and ONNX.stat().st_size > 1_000_000:
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(HF_ONNX, ONNX)


def preprocess(im: Image.Image):
    im512 = im.convert('RGB').resize((512, 512), Image.BILINEAR)
    arr = np.asarray(im512, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = (arr - MEAN) / STD
    return arr[None, ...]


def parse_image(path: str):
    ensure_model()
    im = Image.open(path).convert('RGB')
    w, h = im.size
    inp = preprocess(im)
    sess = ort.InferenceSession(str(ONNX), providers=['CPUExecutionProvider'])
    name = sess.get_inputs()[0].name
    logits = sess.run(None, {name: inp})[0]
    if logits.ndim == 4:
        pred = logits[0].argmax(axis=0).astype(np.uint8)
    else:
        pred = logits.argmax(axis=0).astype(np.uint8)
    labels = np.array(
        Image.fromarray(pred).resize((w, h), Image.NEAREST),
        dtype=np.uint8,
    )
    return {'width': w, 'height': h, 'ids': labels.tobytes()}


def main():
    job = json.loads(sys.stdin.read())
    result = parse_image(job['image'])
    out_bin = Path(job['labelsBin'])
    out_bin.parent.mkdir(parents=True, exist_ok=True)
    out_bin.write_bytes(result['ids'])
    print(json.dumps({'ok': True, 'width': result['width'], 'height': result['height'], 'labelsPath': str(out_bin)}))


if __name__ == '__main__':
    main()

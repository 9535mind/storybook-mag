"""결과 얼굴 수·위치·ArcFace. 유료 API 없음. 임계값은 호출하지 않는다."""
from __future__ import annotations

import contextlib
import io
import json
import sys

import cv2
from insightface.app import FaceAnalysis


def box_norm(face, w, h):
    x0, y0, x1, y1 = [float(v) for v in face.bbox]
    return {
        'x': max(0.0, x0 / w),
        'y': max(0.0, y0 / h),
        'w': max(0.0, (x1 - x0) / w),
        'h': max(0.0, (y1 - y0) / h),
    }


def largest(faces):
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def main():
    job = json.loads(sys.stdin.read())
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink):
        app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(640, 640))
    src = cv2.imread(job['src'])
    out = cv2.imread(job['out'])
    if src is None or out is None:
        print(json.dumps({'ok': False, 'error': 'image_read_failed'}))
        return
    with contextlib.redirect_stdout(sink):
        src_faces = app.get(src)
        out_faces = app.get(out)
    hs, ws = src.shape[:2]
    ho, wo = out.shape[:2]
    report = {
        'ok': True,
        'engine': 'insightface-buffalo_l',
        'srcCount': len(src_faces),
        'outCount': len(out_faces),
        'srcBox': None,
        'outBox': None,
        'cosine': None,
        'dx': None,
        'dy': None,
        'dist': None,
        'scale': None,
    }
    if not src_faces or not out_faces:
        report['ok'] = False
        report['error'] = 'undetected'
        print(json.dumps(report))
        return
    a = largest(src_faces)
    b = largest(out_faces)
    va = a.normed_embedding
    vb = b.normed_embedding
    if va is None or vb is None:
        report['ok'] = False
        report['error'] = 'undetected'
        print(json.dumps(report))
        return
    report['srcBox'] = box_norm(a, ws, hs)
    report['outBox'] = box_norm(b, wo, ho)
    report['cosine'] = float((va * vb).sum())
    sx = report['srcBox']['x'] + report['srcBox']['w'] / 2
    sy = report['srcBox']['y'] + report['srcBox']['h'] / 2
    ox = report['outBox']['x'] + report['outBox']['w'] / 2
    oy = report['outBox']['y'] + report['outBox']['h'] / 2
    report['dx'] = ox - sx
    report['dy'] = oy - sy
    report['dist'] = (report['dx'] ** 2 + report['dy'] ** 2) ** 0.5
    src_area = max(1e-9, report['srcBox']['w'] * report['srcBox']['h'])
    report['scale'] = (report['outBox']['w'] * report['outBox']['h']) / src_area
    print(json.dumps(report))


if __name__ == '__main__':
    main()

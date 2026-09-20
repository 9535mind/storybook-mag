"""무과금. 「옷 녹이기」가 원래 몸을 투영하는지 자세 모델로 잰다.

원본과 결과는 같은 크기·같은 얼굴 위치이므로 화소 좌표를 그대로 비교한다.
어깨·엉덩이는 자세 모델이 직접 준다. 가슴 꼭짓점은 어떤 자세 모델도 주지 않아서,
몸에 붙는 옷일 때만 쓸 수 있는 보조 측정(세로 밝기 굴곡)으로 따로 잰다.

    py -3 scripts/desk-body-projection.py <원본> <결과> [<결과> ...]
"""

import json
import sys

import numpy as np
from PIL import Image

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL = "tmp-faceswap-test/_models/pose_landmarker_heavy.task"
L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24


def make_landmarker():
    # output_segmentation_masks 는 작은 그림에서 네이티브 크래시를 낸다(파이썬에서 못 잡음).
    # 몸통 영역은 관절 좌표로 직접 잡는다.
    opts = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL),
    )
    return vision.PoseLandmarker.create_from_options(opts)


def measure(landmarker, path):
    # create_from_file 은 투명 채널이 있는 PNG 에서 죽는다. 직접 RGB 로 읽어 넘긴다.
    pil = Image.open(path).convert("RGB")
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(pil))
    res = landmarker.detect(img)
    if not res.pose_landmarks:
        return {"path": path, "error": "사람을 못 찾음"}
    lm = res.pose_landmarks[0]
    h, w = img.height, img.width

    def pt(i):
        return np.array([lm[i].x * w, lm[i].y * h])

    ls, rs, lh, rh = pt(L_SHOULDER), pt(R_SHOULDER), pt(L_HIP), pt(R_HIP)
    shoulder_mid = (ls + rs) / 2
    hip_mid = (lh + rh) / 2
    torso = float(np.linalg.norm(hip_mid - shoulder_mid))

    # 엔진마다 내보내는 해상도가 달라서 화소 그대로는 비교가 안 된다.
    # 모두 그림 높이에 대한 비율로 바꿔 놓는다.
    out = {
        "path": path,
        "size": f"{w}x{h}",
        "shoulderY": round(float(shoulder_mid[1]) / h, 4),
        "shoulderW": round(float(np.linalg.norm(ls - rs)) / h, 4),
        "hipY": round(float(hip_mid[1]) / h, 4),
        "hipW": round(float(np.linalg.norm(lh - rh)) / h, 4),
        "torsoLen": round(torso / h, 4),
        # 잘린 범위·해상도가 달라도 변하지 않는 몸 비율. 비교는 이것으로 한다.
        "shoulderW_perTorso": round(float(np.linalg.norm(ls - rs)) / torso, 3),
        "hipW_perTorso": round(float(np.linalg.norm(lh - rh)) / torso, 3),
    }

    # 가슴 꼭짓점 보조 측정: 어깨~엉덩이 사이 몸통 안쪽에서 세로 밝기가 가장
    # 볼록한 줄. 몸에 붙는 옷이라야 뜻이 있다. 헐렁한 옷이면 무의미하므로
    # 굴곡 세기(prom)를 같이 내보내 판단할 수 있게 한다.
    gray = np.asarray(pil.convert("L"), dtype=float)
    y0 = max(0, int(shoulder_mid[1] + torso * 0.12))
    y1 = min(h, int(shoulder_mid[1] + torso * 0.72))
    x0 = max(0, int(min(ls[0], rs[0]) + abs(ls[0] - rs[0]) * 0.22))
    x1 = min(w, int(max(ls[0], rs[0]) - abs(ls[0] - rs[0]) * 0.22))
    if y1 > y0 + 8 and x1 > x0 + 8:
        rows = gray[y0:y1, x0:x1].mean(axis=1)
        if len(rows) > 12:
            ys = np.arange(y0, y0 + len(rows))  # 그림 전체 기준 y
            vals = rows
            k = max(3, len(vals) // 12) | 1
            smooth = np.convolve(vals, np.ones(k) / k, mode="same")
            peak = int(np.argmax(smooth[k:-k])) + k
            out["bustY"] = round(float(ys[peak]) / h, 4)
            out["bustFrac"] = round((float(ys[peak]) - shoulder_mid[1]) / torso, 3)
            out["bustProminence"] = round(float(smooth[peak] - np.median(smooth[k:-k])), 1)
    return out


def main():
    src_path, *result_paths = sys.argv[1:]
    landmarker = make_landmarker()
    src = measure(landmarker, src_path)
    print("원본 :", json.dumps(src, ensure_ascii=False))
    for p in result_paths:
        got = measure(landmarker, p)
        print("\n결과 :", json.dumps(got, ensure_ascii=False))
        if "error" in src or "error" in got:
            continue
        print(
            "차이(몸통 길이 기준 · 잘린 범위 무관) : 어깨폭 {:+.1f}% · 엉덩이폭 {:+.1f}%".format(
                100 * (got["shoulderW_perTorso"] / src["shoulderW_perTorso"] - 1),
                100 * (got["hipW_perTorso"] / src["hipW_perTorso"] - 1),
            )
        )
        if src["size"] == got["size"]:
            print(
                "차이(그림 기준 · 같은 크기일 때만) : 어깨높이 {:+.2f}% · 몸통길이 {:+.1f}%".format(
                    100 * (got["shoulderY"] - src["shoulderY"]),
                    100 * (got["torsoLen"] / src["torsoLen"] - 1),
                )
            )
        if "bustFrac" in src and "bustFrac" in got:
            print(
                "       가슴높이(몸통 대비) 원본 {:.3f} → 결과 {:.3f} ({:+.1f}%p, 굴곡세기 {:.1f}→{:.1f})".format(
                    src["bustFrac"], got["bustFrac"],
                    100 * (got["bustFrac"] - src["bustFrac"]),
                    src["bustProminence"], got["bustProminence"],
                )
            )


main()

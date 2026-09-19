/** LOOK 브라우저·서버 공통 모델 핀. 불변 revision + SHA. 사각형 마스크 대체 금지. */

export const DESK_LOOK_MODELS = {
  segformer: {
    id: 'segformer_b2_clothes_quantized',
    url: 'https://huggingface.co/Xenova/segformer_b2_clothes/resolve/cb6ac44e641faa309f29561c1afe08d87ef52631/onnx/model_quantized.onnx',
    revision: 'cb6ac44e641faa309f29561c1afe08d87ef52631',
    sha256: '2b18fbdd196a7ee12702c2fceaa6f812fe70d1154573a43bd62667b9157ee48d',
    bytes: 28837959,
  },
  rec: {
    id: 'buffalo_l_w600k_r50',
    url: 'https://huggingface.co/public-data/insightface/resolve/53577c23cb5e1c5fd0f632d6a1353e8e87b44986/models/buffalo_l/w600k_r50.onnx',
    revision: '53577c23cb5e1c5fd0f632d6a1353e8e87b44986',
    sha256: '4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43',
    bytes: 174383860,
  },
} as const

export const LOOK_MASK_MIN_WHITE = 1500

export function isApprovedLookModelSha(segformerSha?: string, recSha?: string): boolean {
  return (
    segformerSha === DESK_LOOK_MODELS.segformer.sha256 && recSha === DESK_LOOK_MODELS.rec.sha256
  )
}

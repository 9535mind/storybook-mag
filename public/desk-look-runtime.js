/**
 * LOOK 파싱·임베딩 런타임. UI에 엔진 선택을 두지 않는다.
 * 테스트는 python 백엔드, 브라우저는 ONNX. 밝기 패치로 되돌리지 않는다.
 */
(function (global) {
  async function prepare(image, opts) {
    if (global.__deskLookBackend && typeof global.__deskLookBackend.prepare === 'function') {
      return global.__deskLookBackend.prepare(image, opts)
    }
    if (global.DeskLookOnnx && typeof global.DeskLookOnnx.prepare === 'function') {
      return global.DeskLookOnnx.prepare(image, opts)
    }
    return { ok: false, reason: 'parse_unavailable', labels: [], embeds: [], faces: [], width: 0, height: 0 }
  }

  async function embedCast(image, face) {
    if (global.__deskLookBackend && typeof global.__deskLookBackend.embedCast === 'function') {
      return global.__deskLookBackend.embedCast(image, face)
    }
    if (global.DeskLookOnnx && typeof global.DeskLookOnnx.embedCast === 'function') {
      return global.DeskLookOnnx.embedCast(image, face)
    }
    return { ok: false, reason: 'undetected', dim: 0, vec: null }
  }

  global.DeskLookRuntime = { prepare, embedCast }
})(typeof window !== 'undefined' ? window : globalThis)

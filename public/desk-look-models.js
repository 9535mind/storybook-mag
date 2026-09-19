var DeskLookModels = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // functions/lib/desk-look-models.ts
  var desk_look_models_exports = {};
  __export(desk_look_models_exports, {
    DESK_LOOK_MODELS: () => DESK_LOOK_MODELS,
    LOOK_MASK_MIN_WHITE: () => LOOK_MASK_MIN_WHITE,
    isApprovedLookModelSha: () => isApprovedLookModelSha
  });
  var DESK_LOOK_MODELS = {
    segformer: {
      id: "segformer_b2_clothes_quantized",
      url: "https://huggingface.co/Xenova/segformer_b2_clothes/resolve/cb6ac44e641faa309f29561c1afe08d87ef52631/onnx/model_quantized.onnx",
      revision: "cb6ac44e641faa309f29561c1afe08d87ef52631",
      sha256: "2b18fbdd196a7ee12702c2fceaa6f812fe70d1154573a43bd62667b9157ee48d",
      bytes: 28837959
    },
    rec: {
      id: "buffalo_l_w600k_r50",
      url: "https://huggingface.co/public-data/insightface/resolve/53577c23cb5e1c5fd0f632d6a1353e8e87b44986/models/buffalo_l/w600k_r50.onnx",
      revision: "53577c23cb5e1c5fd0f632d6a1353e8e87b44986",
      sha256: "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
      bytes: 174383860
    }
  };
  var LOOK_MASK_MIN_WHITE = 1500;
  function isApprovedLookModelSha(segformerSha, recSha) {
    return segformerSha === DESK_LOOK_MODELS.segformer.sha256 && recSha === DESK_LOOK_MODELS.rec.sha256;
  }
  return __toCommonJS(desk_look_models_exports);
})();

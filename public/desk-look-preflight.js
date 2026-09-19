var DeskLookLib = (() => {
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

  // functions/lib/desk-look-preflight.ts
  var desk_look_preflight_exports = {};
  __export(desk_look_preflight_exports, {
    assembleVtonIdentityMask: () => assembleVtonIdentityMask,
    buildLookPayload: () => buildLookPayload,
    checkCastEmbeds: () => checkCastEmbeds,
    diagnoseClothesRegions: () => diagnoseClothesRegions,
    gateLookVisual: () => gateLookVisual,
    linkCastFaces: () => linkCastFaces,
    lookLayoutFromFaces: () => lookLayoutFromFaces,
    personBoxFromFace: () => personBoxFromFace,
    runDeskLookPreflight: () => runDeskLookPreflight
  });

  // functions/lib/desk-clothes-parse.ts
  var CLOTHES_UPPER_LABELS = ["Upper-clothes", "Dress", "Belt", "Scarf"];
  var CLOTHES_LOWER_LABELS = ["Skirt", "Pants"];
  var CLOTHES_EDIT_LABELS = [
    ...CLOTHES_UPPER_LABELS,
    ...CLOTHES_LOWER_LABELS
  ];
  var VTON_IDENTITY_PROTECT_LABELS = [
    "Background",
    "Hat",
    "Hair",
    "Sunglasses",
    "Face",
    "Left-shoe",
    "Right-shoe",
    "Left-leg",
    "Right-leg",
    "Left-arm",
    "Right-arm",
    "Bag"
  ];
  var VTON_MODEL_BODY_LABELS = [
    "Upper-clothes",
    "Skirt",
    "Pants",
    "Dress",
    "Belt",
    "Scarf"
  ];
  var MASK_MIN_WHITE = 1500;
  function isClothesEditLabel(label) {
    return CLOTHES_EDIT_LABELS.includes(label);
  }
  function isClothesUpperLabel(label) {
    return CLOTHES_UPPER_LABELS.includes(label);
  }
  function isClothesLowerLabel(label) {
    return CLOTHES_LOWER_LABELS.includes(label);
  }
  function diagnoseClothesRegions(whiteUpper, whiteLower) {
    return {
      upper: whiteUpper,
      lower: whiteLower,
      together: whiteUpper >= MASK_MIN_WHITE && whiteLower >= MASK_MIN_WHITE
    };
  }
  var ARM_LABELS = /* @__PURE__ */ new Set(["Left-arm", "Right-arm"]);
  var LEG_LABELS = /* @__PURE__ */ new Set(["Left-leg", "Right-leg"]);
  function median(xs) {
    if (!xs.length) return 0;
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function bodyGuidesFromLabels(labels, width, height) {
    const armSpans = [];
    const legSpans = [];
    const armYs = [];
    const legYs = [];
    for (let y = 0; y < height; y++) {
      let arm0 = width;
      let arm1 = -1;
      let leg0 = width;
      let leg1 = -1;
      for (let x = 0; x < width; x++) {
        const lab = labels[y * width + x] || "";
        if (ARM_LABELS.has(lab)) {
          if (x < arm0) arm0 = x;
          if (x > arm1) arm1 = x;
        }
        if (LEG_LABELS.has(lab)) {
          if (x < leg0) leg0 = x;
          if (x > leg1) leg1 = x;
        }
      }
      if (arm1 >= 0) {
        armSpans.push(arm1 - arm0 + 1);
        armYs.push(y);
      }
      if (leg1 >= 0) {
        legSpans.push(leg1 - leg0 + 1);
        legYs.push(y);
      }
    }
    const shoulder = median(armSpans);
    const hip = median(legSpans);
    return {
      shoulder,
      hip,
      armRows: armSpans.length,
      legRows: legSpans.length,
      yShoulder: median(armYs),
      yHip: median(legYs)
    };
  }
  function assembleClothesRegionMasks(options) {
    const { labels, width, height, woman, man } = options;
    const n = width * height;
    const empty = {
      mask: new Uint8Array(n),
      upper: new Uint8Array(n),
      lower: new Uint8Array(n),
      white: 0,
      whiteUpper: 0,
      whiteLower: 0,
      ok: false,
      reason: "parse_size"
    };
    if (labels.length !== n) return empty;
    const mask = new Uint8Array(n);
    const upper = new Uint8Array(n);
    const lower = new Uint8Array(n);
    let white = 0;
    let whiteUpper = 0;
    let whiteLower = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (man && pointIn(man, nx, ny)) continue;
        if (woman && !pointIn(woman, nx, ny)) continue;
        const lab = labels[p] || "";
        if (!isClothesEditLabel(lab)) continue;
        mask[p] = 255;
        white += 1;
        if (isClothesUpperLabel(lab)) {
          upper[p] = 255;
          whiteUpper += 1;
        }
        if (isClothesLowerLabel(lab)) {
          lower[p] = 255;
          whiteLower += 1;
        }
      }
    }
    const ok = white >= MASK_MIN_WHITE;
    return { mask, upper, lower, white, whiteUpper, whiteLower, ok, reason: ok ? "" : "mask_too_small" };
  }
  var HAND_ARM_SPAN_FRAC = 0.08;
  var HAND_DISTAL_FRAC = 0.22;
  var BODY_SPAN_LABELS = /* @__PURE__ */ new Set([
    "Upper-clothes",
    "Skirt",
    "Pants",
    "Dress",
    "Belt",
    "Scarf",
    "Left-leg",
    "Right-leg"
  ]);
  var VTON_CLOTHES_BLEED_PX = 12;
  var VTON_FACE_CLOTHES_CLEAR_PX = 22;
  var VTON_SHOE_PANTS_CLEAR_PX = 12;
  var VTON_SLEEVE_CLEAR_PX = 12;
  var VTON_ISLAND_MIN = 240;
  var VTON_CLOTHES_COLOR_DIST = 36;
  var VTON_DENIM_COLOR_DIST = 40;
  var CLOTHES_NEAR_LABELS = /* @__PURE__ */ new Set(["Upper-clothes", "Dress", "Belt", "Scarf", "Skirt", "Pants"]);
  var PANTS_NEAR_LABELS = /* @__PURE__ */ new Set(["Pants", "Skirt"]);
  function armHandProtect(labels, width, height) {
    const n = width * height;
    const hands = new Uint8Array(n);
    for (const name of ARM_LABELS) {
      let y0 = height;
      let y1 = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if ((labels[y * width + x] || "") !== name) continue;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (y1 < 0) continue;
      const span = y1 - y0 + 1;
      const cut = span <= height * HAND_ARM_SPAN_FRAC ? y0 : y1 - Math.floor(span * HAND_DISTAL_FRAC);
      for (let y = cut; y <= y1; y++) {
        for (let x = 0; x < width; x++) {
          if ((labels[y * width + x] || "") === name) hands[y * width + x] = 1;
        }
      }
    }
    return hands;
  }
  function nearAnyLabel(labels, width, height, x, y, names, radius) {
    const x0 = Math.max(0, x - radius);
    const x1 = Math.min(width - 1, x + radius);
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (!names.has(labels[yy * width + xx] || "")) continue;
        if (Math.hypot(xx - x, yy - y) <= radius) return true;
      }
    }
    return false;
  }
  function labeledMedianRgb(rgba, labels, name) {
    const rs = [];
    const gs = [];
    const bs = [];
    for (let p = 0; p < labels.length; p++) {
      if ((labels[p] || "") !== name) continue;
      const i = p * 4;
      rs.push(rgba[i]);
      gs.push(rgba[i + 1]);
      bs.push(rgba[i + 2]);
    }
    return { r: median(rs), g: median(gs), b: median(bs), n: rs.length };
  }
  function isSkinLike(rgba, p) {
    const i = p * 4;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    return r > 85 && r + 8 >= g && r > b + 6 && (r + g + b) / 3 > 75;
  }
  function rgbDist(rgba, p, sample) {
    const i = p * 4;
    return Math.hypot(rgba[i] - sample.r, rgba[i + 1] - sample.g, rgba[i + 2] - sample.b);
  }
  function fillBetweenBodyGaps(mask, labels, width, height, woman, man) {
    let filled = 0;
    for (let y = 0; y < height; y++) {
      let x0 = width;
      let x1 = -1;
      for (let x = 0; x < width; x++) {
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (man && pointIn(man, nx, ny)) continue;
        if (woman && !pointIn(woman, nx, ny)) continue;
        if (!BODY_SPAN_LABELS.has(labels[y * width + x] || "")) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
      if (x1 < 0 || x1 - x0 < 8) continue;
      for (let x = x0; x <= x1; x++) {
        const p = y * width + x;
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (man && pointIn(man, nx, ny)) continue;
        if (woman && !pointIn(woman, nx, ny)) continue;
        if (mask[p] >= 128) continue;
        if ((labels[p] || "") !== "Background") continue;
        mask[p] = 255;
        filled += 1;
      }
    }
    return filled;
  }
  function dropSmallProtectIslands(mask, labels, width, height, minArea) {
    const n = width * height;
    const seen = new Uint8Array(n);
    let dropped = 0;
    const qx = new Int32Array(n);
    const qy = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (mask[start] >= 128 || seen[start]) continue;
      let head = 0;
      let tail = 0;
      qx[tail] = start % width;
      qy[tail] = start / width | 0;
      tail += 1;
      seen[start] = 1;
      const cells = [];
      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head += 1;
        const p = y * width + x;
        cells.push(p);
        const nbs = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1]
        ];
        for (const [xx, yy] of nbs) {
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const q = yy * width + xx;
          if (seen[q] || mask[q] >= 128) continue;
          seen[q] = 1;
          qx[tail] = xx;
          qy[tail] = yy;
          tail += 1;
        }
      }
      if (cells.length >= minArea) continue;
      for (const p of cells) {
        const lab = labels?.[p] || "";
        if (VTON_IDENTITY_PROTECT_LABELS.includes(lab)) continue;
        mask[p] = 255;
        dropped += 1;
      }
    }
    return dropped;
  }
  function bleedEditIntoBackground(mask, labels, width, height, radius, woman, man) {
    if (radius <= 0) return 0;
    const extra = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (man && pointIn(man, nx, ny)) continue;
        if (woman && !pointIn(woman, nx, ny)) continue;
        if (mask[p] >= 128) continue;
        if ((labels[p] || "") !== "Background") continue;
        let near = false;
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        for (let yy = y0; yy <= y1 && !near; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (mask[yy * width + xx] < 128) continue;
            if (Math.hypot(xx - x, yy - y) <= radius) near = true;
          }
        }
        if (near) extra.push(p);
      }
    }
    for (const p of extra) mask[p] = 255;
    return extra.length;
  }
  function assembleVtonIdentityMask(options) {
    const { labels, width, height, woman, man, srcRgba } = options;
    const n = width * height;
    const empty = {
      mask: new Uint8Array(n),
      white: 0,
      whiteBody: 0,
      whiteBleed: 0,
      handProtect: 0,
      releasedNeck: 0,
      releasedCuff: 0,
      releasedClothesColor: 0,
      releasedSleeve: 0,
      releasedIslands: 0,
      releasedGaps: 0,
      ok: false,
      reason: "parse_size"
    };
    if (labels.length !== n) return empty;
    const hands = armHandProtect(labels, width, height);
    const jacket = srcRgba && srcRgba.length === n * 4 ? labeledMedianRgb(srcRgba, labels, "Upper-clothes") : { r: 0, g: 0, b: 0, n: 0 };
    const denim = srcRgba && srcRgba.length === n * 4 ? labeledMedianRgb(srcRgba, labels, "Pants") : { r: 0, g: 0, b: 0, n: 0 };
    let pantsY1 = -1;
    for (let p = 0; p < n; p++) {
      const lab = labels[p] || "";
      const y = p / width | 0;
      if (lab === "Pants" || lab === "Skirt") {
        if (y > pantsY1) pantsY1 = y;
      }
    }
    const mask = new Uint8Array(n);
    let whiteBody = 0;
    let handProtect = 0;
    let releasedNeck = 0;
    let releasedCuff = 0;
    let releasedClothesColor = 0;
    let releasedSleeve = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (man && pointIn(man, nx, ny)) continue;
        if (woman && !pointIn(woman, nx, ny)) continue;
        const lab = labels[p] || "";
        if (CLOTHES_EDIT_LABELS.includes(lab)) {
          mask[p] = 255;
          whiteBody += 1;
          continue;
        }
        if (VTON_MODEL_BODY_LABELS.includes(lab) && !hands[p]) {
          mask[p] = 255;
          whiteBody += 1;
          continue;
        }
        const jacketLike = jacket.n > 0 && srcRgba ? rgbDist(srcRgba, p, jacket) <= VTON_CLOTHES_COLOR_DIST : false;
        const denimLike = denim.n > 0 && srcRgba ? rgbDist(srcRgba, p, denim) <= VTON_DENIM_COLOR_DIST : false;
        if (lab === "Face" || lab === "Hair" || lab === "Hat") {
          if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, VTON_FACE_CLOTHES_CLEAR_PX)) {
            mask[p] = 255;
            releasedNeck += 1;
            continue;
          }
          if (jacketLike) {
            mask[p] = 255;
            releasedClothesColor += 1;
            continue;
          }
        }
        if (lab === "Left-shoe" || lab === "Right-shoe") {
          const cuffBand = pantsY1 >= 0 && y <= pantsY1;
          const cuffTouch = nearAnyLabel(labels, width, height, x, y, PANTS_NEAR_LABELS, VTON_SHOE_PANTS_CLEAR_PX);
          if (cuffBand || cuffTouch) {
            mask[p] = 255;
            releasedCuff += 1;
            continue;
          }
        }
        if (hands[p]) {
          if (denimLike || srcRgba && !isSkinLike(srcRgba, p)) {
            mask[p] = 255;
            releasedClothesColor += 1;
            continue;
          }
          handProtect += 1;
          continue;
        }
        if (ARM_LABELS.has(lab) && srcRgba && !isSkinLike(srcRgba, p)) {
          if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, VTON_SLEEVE_CLEAR_PX)) {
            mask[p] = 255;
            releasedSleeve += 1;
            continue;
          }
        }
      }
    }
    const releasedGaps = fillBetweenBodyGaps(mask, labels, width, height, woman, man);
    const whiteBleed = bleedEditIntoBackground(
      mask,
      labels,
      width,
      height,
      VTON_CLOTHES_BLEED_PX,
      woman,
      man
    );
    const releasedIslands = dropSmallProtectIslands(mask, labels, width, height, VTON_ISLAND_MIN);
    let white = 0;
    for (let i = 0; i < n; i++) if (mask[i] >= 128) white += 1;
    const ok = white >= MASK_MIN_WHITE;
    return {
      mask,
      white,
      whiteBody,
      whiteBleed,
      handProtect,
      releasedNeck,
      releasedCuff,
      releasedClothesColor,
      releasedSleeve,
      releasedIslands,
      releasedGaps,
      ok,
      reason: ok ? "" : "mask_too_small"
    };
  }
  function pointIn(box, nx, ny) {
    if (!box) return false;
    return nx >= box.x && nx <= box.x + box.w && ny >= box.y && ny <= box.y + box.h;
  }
  function assembleClothesParseMask(options) {
    const assembled = assembleClothesRegionMasks(options);
    return {
      mask: assembled.mask,
      white: assembled.white,
      whiteUpper: assembled.whiteUpper,
      whiteLower: assembled.whiteLower,
      ok: assembled.ok,
      reason: assembled.reason
    };
  }
  function parseInvasionCounts(labels, mask) {
    let background = 0;
    let skin = 0;
    let hair = 0;
    let otherPersonGuess = 0;
    for (let p = 0; p < mask.length; p++) {
      if (mask[p] < 128) continue;
      const lab = labels[p] || "";
      if (lab === "Background") background += 1;
      if (lab === "Hair" || lab === "Hat") hair += 1;
      if (lab === "Face" || lab === "Left-arm" || lab === "Right-arm" || lab === "Left-leg" || lab === "Right-leg") {
        skin += 1;
      }
      if (!isClothesEditLabel(lab)) otherPersonGuess += 1;
    }
    return { background, skin, hair, otherPersonGuess };
  }

  // functions/lib/desk-look-visual-gate.ts
  var WHITE_MAD_MIN = 24;
  var WHITE_CORR_MAX = 0.88;
  var BODY_CRUSH_RATIO = 0.82;
  var CLOTHING_EXPLODE_RATIO = 1.22;
  var SEAM_LUM_REL_MAX = 1.05;
  var SEAM_TEX_MIN = 0.42;
  var SEAM_BAND_PX = 3;
  var SEAM_REMNANT_DARK = 78;
  var SEAM_REMNANT_CLOTHES_MAX = 120;
  var SEAM_REMNANT_CONTRAST = 28;
  var SEAM_REMNANT_MIN_RUN = 28;
  var SEAM_REMNANT_MIN_ELONG = 3.2;
  var VISUAL_REASON_ORDER = ["clothes_goal", "mask_seam", "silhouette"];
  function lum(rgba, i) {
    return (rgba[i] * 3 + rgba[i + 1] * 4 + rgba[i + 2] * 1) / 8;
  }
  function rgbMad(a, b, i) {
    return (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
  }
  function chromaDist(a, ia, b, ib) {
    const ar = a[ia] - a[ia + 1];
    const ab = a[ia] - a[ia + 2];
    const br = b[ib] - b[ib + 1];
    const bb = b[ib] - b[ib + 2];
    return Math.hypot(ar - br, ab - bb);
  }
  function pearson(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 32) return 1;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
    }
    const mx = sx / n;
    const my = sy / n;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx;
      const b = ys[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 1;
  }
  function whiteStats(src, out, pick, len) {
    let n = 0;
    let sum = 0;
    let max = 0;
    const sl = [];
    const ol = [];
    for (let p = 0; p < len; p++) {
      if (!pick(p)) continue;
      const i = p * 4;
      const mad = rgbMad(src, out, i);
      sum += mad;
      n += 1;
      if (mad > max) max = mad;
      sl.push(lum(src, i));
      ol.push(lum(out, i));
    }
    return { n, mad: n ? sum / n : 0, max, corr: pearson(sl, ol) };
  }
  function cornerBg(rgba, width, height) {
    const pts = [
      [1, 1],
      [width - 2, 1],
      [1, height - 2],
      [width - 2, height - 2]
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [x, y] of pts) {
      const i = (y * width + x) * 4;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
    }
    return { r: r / 4, g: g / 4, b: b / 4 };
  }
  function isPerson(rgba, i, bg) {
    const dr = rgba[i] - bg.r;
    const dg = rgba[i + 1] - bg.g;
    const db = rgba[i + 2] - bg.b;
    return dr * dr + dg * dg + db * db > 22 * 22;
  }
  function whiteBBox(mask, width, height) {
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] < 128) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    return { x0, y0, x1, y1 };
  }
  function rowSpan(rgba, width, y, x0, x1, bg) {
    let left = -1;
    let right = -1;
    for (let x = x0; x <= x1; x++) {
      if (!isPerson(rgba, (y * width + x) * 4, bg)) continue;
      if (left < 0) left = x;
      right = x;
    }
    return left < 0 ? 0 : right - left + 1;
  }
  function texAt(rgba, width, height, x, y) {
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const v = lum(rgba, (yy * width + xx) * 4);
        sum += v;
        sum2 += v * v;
        n += 1;
      }
    }
    if (n < 4) return 0;
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  }
  function ySplitMasks(mask, width, height) {
    const box = whiteBBox(mask, width, height);
    const upper = new Uint8Array(mask.length);
    const lower = new Uint8Array(mask.length);
    if (!box) return { upper, lower };
    const yMid = box.y0 + Math.floor((box.y1 - box.y0) * 0.48);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (mask[p] < 128) continue;
        if (y < yMid) upper[p] = 255;
        else lower[p] = 255;
      }
    }
    return { upper, lower };
  }
  function protectPersonSpan(src, mask, width, height, y0, y1, bg) {
    const spans = [];
    for (let y = y0; y <= y1; y++) {
      let left = -1;
      let right = -1;
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (mask[p] >= 128) continue;
        if (!isPerson(src, p * 4, bg)) continue;
        if (left < 0) left = x;
        right = x;
      }
      if (left >= 0) spans.push(right - left + 1);
    }
    if (!spans.length) return 0;
    spans.sort((a, b) => a - b);
    return spans[Math.floor(spans.length / 2)];
  }
  function regionSilhouette(src, out, region, width, height, bodyRef) {
    const empty = {
      outWidth: 0,
      bodyRef,
      bodyMin: bodyRef * BODY_CRUSH_RATIO,
      clothingWidth: 0,
      crushed: false,
      exploded: false,
      ok: true,
      rows: 0
    };
    const box = whiteBBox(region, width, height);
    if (!box || bodyRef <= 1) return empty;
    const bg = cornerBg(src, width, height);
    const pad = Math.max(2, Math.round(width * 0.04));
    const x0 = Math.max(0, box.x0 - pad);
    const x1 = Math.min(width - 1, box.x1 + pad);
    let srcSum = 0;
    let outSum = 0;
    let rows = 0;
    for (let y = box.y0; y <= box.y1; y++) {
      let has = false;
      for (let x = box.x0; x <= box.x1; x++) {
        if (region[y * width + x] >= 128) {
          has = true;
          break;
        }
      }
      if (!has) continue;
      srcSum += rowSpan(src, width, y, x0, x1, bg);
      outSum += rowSpan(out, width, y, x0, x1, bg);
      rows += 1;
    }
    const clothingWidth = rows ? srcSum / rows : 0;
    const outWidth = rows ? outSum / rows : 0;
    const bodyMin = bodyRef * BODY_CRUSH_RATIO;
    const crushed = rows >= 8 && outWidth + 0.5 < bodyMin;
    const exploded = rows >= 8 && clothingWidth > 1 && outWidth > clothingWidth * CLOTHING_EXPLODE_RATIO;
    return {
      outWidth,
      bodyRef,
      bodyMin,
      clothingWidth,
      crushed,
      exploded,
      ok: !crushed && !exploded,
      rows
    };
  }
  function regionSeam(src, out, region, width, height) {
    const neigh = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    let n = 0;
    let srcLum = 0;
    let outLum = 0;
    let srcCh = 0;
    let outCh = 0;
    let srcTw = 0;
    let outTw = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        if (region[p] < 128) continue;
        for (const [dx, dy] of neigh) {
          const qx = x + dx;
          const qy = y + dy;
          const q = qy * width + qx;
          if (region[q] >= 128) continue;
          const iw = p * 4;
          const ib = q * 4;
          srcLum += Math.abs(lum(src, iw) - lum(src, ib));
          outLum += Math.abs(lum(out, iw) - lum(out, ib));
          srcCh += chromaDist(src, iw, src, ib);
          outCh += chromaDist(out, iw, out, ib);
          srcTw += texAt(src, width, height, x, y);
          outTw += texAt(out, width, height, x, y);
          n += 1;
          break;
        }
      }
    }
    const srcLumJump = n ? srcLum / n : 0;
    const outLumJump = n ? outLum / n : 0;
    const srcChromaJump = n ? srcCh / n : 0;
    const outChromaJump = n ? outCh / n : 0;
    const srcTexWhite = n ? srcTw / n : 0;
    const outTexWhite = n ? outTw / n : 0;
    const lumRel = Math.abs(outLumJump - srcLumJump) / Math.max(srcLumJump, 8);
    const texRatio = outTexWhite / Math.max(srcTexWhite, 0.8);
    const torn = n >= 24 && lumRel > SEAM_LUM_REL_MAX;
    const mashed = n >= 24 && srcTexWhite >= 2 && texRatio < SEAM_TEX_MIN;
    return {
      n,
      srcLumJump,
      outLumJump,
      srcChromaJump,
      outChromaJump,
      srcTexWhite,
      outTexWhite,
      lumRel,
      texRatio,
      remnantN: 0,
      remnantMaxRun: 0,
      remnantElong: 0,
      remnantOk: true,
      ok: !torn && !mashed
    };
  }
  function medianLum(src, pick) {
    const vals = [];
    for (let p = 0; p < pick.length; p++) {
      if (pick[p] < 128) continue;
      vals.push(lum(src, p * 4));
    }
    if (!vals.length) return 255;
    vals.sort((a, b) => a - b);
    return vals[vals.length >> 1];
  }
  function regionBoundaryRemnant(src, out, region, width, height) {
    const empty = { n: 0, maxRun: 0, elong: 0, ok: true };
    const box = whiteBBox(region, width, height);
    if (!box) return empty;
    const clothesRef = medianLum(src, region);
    if (clothesRef > SEAM_REMNANT_CLOTHES_MAX) return empty;
    const r = SEAM_BAND_PX;
    const handCut = box.y0 + Math.floor((box.y1 - box.y0 + 1) * 0.78);
    const hits = new Uint8Array(width * height);
    let n = 0;
    for (let y = Math.max(0, box.y0 - r); y <= Math.min(height - 1, Math.min(box.y1 + r, handCut)); y++) {
      for (let x = Math.max(0, box.x0 - r); x <= Math.min(width - 1, box.x1 + r); x++) {
        const p = y * width + x;
        const hereEdit = region[p] >= 128;
        let onBound = false;
        let bright = 0;
        let brightN = 0;
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(width - 1, x + r);
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(height - 1, y + r);
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (Math.hypot(xx - x, yy - y) > r + 0.25) continue;
            const q = yy * width + xx;
            if (region[q] >= 128 !== hereEdit) onBound = true;
            if (region[q] < 128) continue;
            const ql = lum(out, q * 4);
            if (ql >= SEAM_REMNANT_DARK + 18) {
              bright += ql;
              brightN += 1;
            }
          }
        }
        if (!onBound) continue;
        const outL = lum(out, p * 4);
        const srcL = lum(src, p * 4);
        const near = brightN ? bright / brightN : 255;
        if (outL > SEAM_REMNANT_DARK) continue;
        if (srcL > 110) continue;
        if (Math.abs(outL - srcL) > 40) continue;
        if (outL > clothesRef + 24) continue;
        if (near - outL < SEAM_REMNANT_CONTRAST) continue;
        hits[p] = 255;
        n += 1;
      }
    }
    if (n < SEAM_REMNANT_MIN_RUN) return { n, maxRun: 0, elong: 0, ok: true };
    const seen = new Uint8Array(width * height);
    let maxRun = 0;
    let bestElong = 0;
    const qx = new Int32Array(n + 8);
    const qy = new Int32Array(n + 8);
    for (let start = 0; start < hits.length; start++) {
      if (hits[start] < 128 || seen[start]) continue;
      let head = 0;
      let tail = 0;
      qx[0] = start % width;
      qy[0] = start / width | 0;
      tail = 1;
      seen[start] = 1;
      let area = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head += 1;
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1]
        ]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const q = yy * width + xx;
          if (seen[q] || hits[q] < 128) continue;
          seen[q] = 1;
          qx[tail] = xx;
          qy[tail] = yy;
          tail += 1;
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const run = Math.max(bw, bh);
      const elong = run / Math.max(1, Math.min(bw, bh));
      if (run > maxRun) {
        maxRun = run;
        bestElong = elong;
      }
      if (area >= SEAM_REMNANT_MIN_RUN && run >= SEAM_REMNANT_MIN_RUN && elong >= SEAM_REMNANT_MIN_ELONG) {
        return { n, maxRun: run, elong, ok: false };
      }
    }
    return { n, maxRun, elong: bestElong, ok: true };
  }
  function changeOk(stats) {
    if (stats.n < MASK_MIN_WHITE) return true;
    return stats.mad >= WHITE_MAD_MIN && stats.corr <= WHITE_CORR_MAX;
  }
  function scoreRegion(name, src, out, region, width, height, bodyRef) {
    const stats = whiteStats(src, out, (p) => region[p] >= 128, width * height);
    const present = stats.n >= MASK_MIN_WHITE;
    const sil = regionSilhouette(src, out, region, width, height, bodyRef);
    const seam = regionSeam(src, out, region, width, height);
    const remnant = regionBoundaryRemnant(src, out, region, width, height);
    seam.remnantN = remnant.n;
    seam.remnantMaxRun = remnant.maxRun;
    seam.remnantElong = remnant.elong;
    seam.remnantOk = remnant.ok;
    seam.ok = seam.ok && remnant.ok;
    const changed = changeOk(stats);
    const failReasons = [];
    if (present && !changed) failReasons.push("clothes_goal");
    if (present && !seam.ok) failReasons.push("mask_seam");
    if (present && !sil.ok) failReasons.push("silhouette");
    return {
      name,
      present,
      n: stats.n,
      mad: stats.mad,
      max: stats.max,
      corr: stats.corr,
      changeOk: changed,
      targetUnverified: true,
      silhouette: sil,
      seam,
      failReasons
    };
  }
  function gateLookVisual(input) {
    const { src, out, mask, width, height, labels } = input;
    const split = input.upperMask && input.lowerMask ? { upper: input.upperMask, lower: input.lowerMask } : ySplitMasks(mask, width, height);
    const bg = cornerBg(src, width, height);
    let shoulder = 0;
    let hip = 0;
    if (labels && labels.length === width * height) {
      const g = bodyGuidesFromLabels(labels, width, height);
      shoulder = g.shoulder;
      hip = g.hip;
    }
    const upperBox = whiteBBox(split.upper, width, height);
    if (shoulder < 8 && upperBox) {
      const y0 = upperBox.y0;
      const y1 = upperBox.y0 + Math.max(4, Math.floor((upperBox.y1 - upperBox.y0) * 0.35));
      const pad = Math.max(2, Math.round(width * 0.04));
      const x0 = Math.max(0, upperBox.x0 - pad);
      const x1 = Math.min(width - 1, upperBox.x1 + pad);
      const spans = [];
      for (let y = y0; y <= y1; y++) {
        const w = rowSpan(src, width, y, x0, x1, bg);
        if (w > 0) spans.push(w);
      }
      if (spans.length) {
        spans.sort((a, b) => a - b);
        shoulder = spans[Math.floor(spans.length / 2)];
      } else {
        shoulder = protectPersonSpan(src, mask, width, height, y0, y1, bg);
      }
    }
    if (hip < 8) hip = shoulder > 8 ? shoulder * 0.78 : 0;
    if (shoulder < 8 && hip >= 8) shoulder = hip / 0.78;
    const upper = scoreRegion("upper", src, out, split.upper, width, height, shoulder);
    const lower = scoreRegion("lower", src, out, split.lower, width, height, hip);
    if (!upper.present && !lower.present) {
      const bodyRef = Math.max(shoulder, hip);
      const only = scoreRegion(upper.n >= lower.n ? "upper" : "lower", src, out, mask, width, height, bodyRef);
      if (only.name === "upper") Object.assign(upper, only);
      else Object.assign(lower, only);
    }
    const all = whiteStats(src, out, (p) => mask[p] >= 128, width * height);
    const failReasons = [];
    for (const r of [upper, lower]) {
      for (const reason of r.failReasons) {
        if (!failReasons.includes(reason)) failReasons.push(reason);
      }
    }
    if (all.n < 8 && !failReasons.includes("clothes_goal")) failReasons.push("clothes_goal");
    failReasons.sort((a, b) => VISUAL_REASON_ORDER.indexOf(a) - VISUAL_REASON_ORDER.indexOf(b));
    const together = upper.present && lower.present;
    return {
      ok: failReasons.length === 0,
      reason: failReasons[0] || "",
      failReasons,
      complete: false,
      clothesGoalKind: "change_only",
      upper,
      lower,
      regions: {
        together,
        upper: { n: upper.n, mad: upper.mad, corr: upper.corr },
        lower: { n: lower.n, mad: lower.mad, corr: lower.corr },
        all
      },
      silhouette: upper.failReasons.includes("silhouette") ? upper.silhouette : lower.silhouette,
      seam: upper.failReasons.includes("mask_seam") ? upper.seam : lower.seam
    };
  }

  // functions/lib/desk-look-preflight.ts
  function personBoxFromFace(face) {
    const x = Math.max(0, face.x - face.w * 0.55);
    const y = Math.max(0, face.y - face.h * 0.75);
    return {
      slot: face.slot,
      x,
      y,
      w: Math.min(1 - x, face.w * 2.8),
      h: Math.min(1 - y, Math.max(face.h * 6.2, 0.6))
    };
  }
  function lookLayoutFromFaces(faces) {
    const womanFace = faces.find((f) => f.slot === "woman");
    const manFace = faces.find((f) => f.slot === "man");
    if (!womanFace) {
      return { woman: { slot: "woman", x: 0, y: 0, w: 1, h: 1 }, man: null };
    }
    if (!manFace) return { woman: { slot: "woman", x: 0, y: 0, w: 1, h: 1 }, man: null };
    return { woman: personBoxFromFace(womanFace), man: personBoxFromFace(manFace) };
  }
  function inBox(box, x, y) {
    if (!box) return false;
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }
  function linkCastFaces(faces, layout, needCouple) {
    if (!faces.length) return { ok: false, reason: "undetected" };
    const womanFaces = faces.filter((f) => inBox(layout.woman, f.x + f.w / 2, f.y + f.h / 2) && f.slot === "woman");
    if (womanFaces.length !== 1) return { ok: false, reason: "woman_face_unlink" };
    if (needCouple) {
      if (!layout.man) return { ok: false, reason: "cast_people" };
      const manFaces = faces.filter((f) => inBox(layout.man, f.x + f.w / 2, f.y + f.h / 2) && f.slot === "man");
      if (manFaces.length !== 1) return { ok: false, reason: "man_face_unlink" };
    } else if (faces.some((f) => f.slot === "man") || faces.length !== 1) {
      return { ok: false, reason: "cast_people" };
    }
    return { ok: true, reason: "" };
  }
  function embedCosine(a, b) {
    if (!a || !b || a.length !== b.length || !a.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }
  function checkCastEmbeds(embeds, needCouple) {
    if (!embeds || !embeds.length) return { ok: false, reason: "undetected" };
    const woman = embeds.find((e) => e.slot === "woman");
    if (!woman || woman.dim !== 512 || !woman.vec?.length) return { ok: false, reason: "undetected" };
    if (needCouple) {
      const man = embeds.find((e) => e.slot === "man");
      if (!man || man.dim !== 512 || !man.vec?.length) return { ok: false, reason: "undetected" };
      if (embedCosine(woman.vec, man.vec) >= 0.99) return { ok: false, reason: "undetected" };
    }
    return { ok: true, reason: "" };
  }
  function runDeskLookPreflight(input) {
    const needCouple = Boolean(input.layout.man);
    const empty = new Uint8Array(Math.max(0, input.width * input.height));
    const link = linkCastFaces(input.faces, input.layout, needCouple);
    const clothes = assembleClothesParseMask({
      labels: input.labels,
      width: input.width,
      height: input.height,
      woman: input.layout.woman,
      man: input.layout.man
    });
    const identity = input.vton ? assembleVtonIdentityMask({
      labels: input.labels,
      width: input.width,
      height: input.height,
      woman: input.layout.woman,
      man: input.layout.man,
      srcRgba: input.srcRgba
    }) : null;
    const assembled = identity ? { mask: identity.mask, white: identity.white, whiteUpper: clothes.whiteUpper, whiteLower: clothes.whiteLower, ok: identity.ok, reason: identity.reason } : clothes;
    const invade = parseInvasionCounts(input.labels, clothes.mask);
    const regions = diagnoseClothesRegions(clothes.whiteUpper, clothes.whiteLower);
    let reason = !link.ok ? link.reason : assembled.reason;
    let ok = link.ok && assembled.ok;
    if (ok && !input.vton && regions.together) {
      ok = false;
      reason = "clothes_regions";
    }
    if (ok && !input.vton && (invade.background > 0 || invade.skin > 0)) {
      ok = false;
      reason = "mask_invade";
    }
    if (ok) {
      if (input.embedOk === false) {
        ok = false;
        reason = "undetected";
      } else {
        const embedGate = checkCastEmbeds(input.embeds, needCouple);
        if (!embedGate.ok) {
          ok = false;
          reason = embedGate.reason;
        }
      }
    }
    const verify = {
      ok,
      reason,
      maskWhite: assembled.white,
      maskMinWhite: MASK_MIN_WHITE,
      maskWhiteUpper: assembled.whiteUpper,
      maskWhiteLower: assembled.whiteLower,
      clothesRegionsTogether: regions.together,
      embedEngineExpected: "insightface-buffalo_l",
      faceSlots: input.embeds?.map((e) => e.slot) || []
    };
    return {
      ok,
      reason,
      mask: assembled.mask.length ? assembled.mask : empty,
      white: assembled.white,
      whiteUpper: assembled.whiteUpper,
      whiteLower: assembled.whiteLower,
      regions,
      layout: input.layout,
      verify
    };
  }
  function buildLookPayload(input) {
    return {
      composeMode: "desk-still",
      deskStep: "look",
      images: [input.source],
      clothesMask: input.clothesMask,
      deskCastLayout: input.layout,
      deskLookVerify: {
        ...input.verify,
        maskSha256: input.maskSha256,
        segformerSha256: input.segformerSha256 || "",
        recSha256: input.recSha256 || ""
      },
      description: input.description,
      deskLook: input.deskLook,
      deskCouple: input.deskCouple,
      deskAction: "none",
      photoreal: true,
      refKind: "body"
    };
  }
  return __toCommonJS(desk_look_preflight_exports);
})();

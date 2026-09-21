#!/usr/bin/env node
/**
 * 무과금. 사무실 CAST 검정 소매가 팔 보호에 남는지.
 * Claude / fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseClothesLabels } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_7389cede-36bd-45f3-b14c-adffb0518d71-5af8867d-7229-499f-9cf1-fd386a0a5554.png'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-office-sleeve')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-clothes-parse.cjs')
const PRE = path.join(ROOT, 'public', 'desk-look-preflight.js')

mkdirSync(OUT, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-parse.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-preflight.ts" --bundle --format=iife --global-name=DeskLookLib --outfile="${PRE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)

const parseMod = await import(`file://${BUNDLE}?t=${Date.now()}`)
const parsed = parseClothesLabels(SRC, path.join(OUT, 'labels.u8'), parseMod.CLOTHES_PARSE_LABELS)
const { width, height, labels } = parsed
execFileSync(
  'py',
  [
    '-3',
    '-c',
    `
import json, sys
from PIL import Image
import numpy as np
from pathlib import Path
job = json.loads(sys.stdin.read())
im = Image.open(job["image"]).convert("RGBA")
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
  ],
  {
    input: JSON.stringify({ image: SRC, out: path.join(OUT, 'src.rgba') }),
    encoding: 'utf8',
  },
)
const rgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba: rgba,
})

function isSkinLike(p) {
  const i = p * 4
  const r = rgba[i]
  const g = rgba[i + 1]
  const b = rgba[i + 2]
  return r > 85 && r + 8 >= g && r > b + 6 && (r + g + b) / 3 > 75
}

const hands = parseMod.armHandProtect(labels, width, height)
let darkArm = 0
let darkArmStillProtect = 0
let darkBodyProtect = 0
let darkHandProtect = 0
let armSkinEdit = 0
for (let p = 0; p < labels.length; p++) {
  const lab = labels[p]
  if (lab !== 'Left-arm' && lab !== 'Right-arm') continue
  const lum = (rgba[p * 4] + rgba[p * 4 + 1] + rgba[p * 4 + 2]) / 3
  if (!isSkinLike(p) || lum <= 110) {
    darkArm += 1
    if (identity.mask[p] < 128) {
      darkArmStillProtect += 1
      if (hands[p]) darkHandProtect += 1
      else darkBodyProtect += 1
    }
  }
  if (identity.mask[p] >= 128 && isSkinLike(p) && lum > 110) armSkinEdit += 1
}

const report = {
  newPaidCall: false,
  wanCalled: false,
  width,
  height,
  releasedSleeve: identity.releasedSleeve,
  darkArm,
  darkArmStillProtect,
  darkBodyProtect,
  darkHandProtect,
  armSkinEdit,
  ok: identity.ok === true && identity.releasedSleeve > 200 && armSkinEdit === 0,
}
writeFileSync(path.join(OUT, 'office-sleeve.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)

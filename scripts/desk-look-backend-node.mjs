#!/usr/bin/env node
/**
 * Node LOOK 백엔드. 진단과 같은 SegFormer·buffalo_l. 유료 이미지 API 없음.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PARSE_PY = path.join(ROOT, 'scripts', 'desk-segformer-parse.py')
const EMBED_PY = path.join(ROOT, 'scripts', 'desk-arcface-embed.py')

export function lastJson(raw) {
  const lines = String(raw)
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('{')) return JSON.parse(lines[i])
  }
  throw new Error('no_json')
}

export function parseClothesLabels(imagePath, labelsBin, labelNames) {
  const raw = execFileSync('py', ['-3', PARSE_PY], {
    input: JSON.stringify({ image: imagePath, labelsBin }),
    encoding: 'utf8',
    timeout: 180000,
    cwd: ROOT,
  })
  const meta = lastJson(raw)
  const ids = readFileSync(labelsBin)
  return {
    labels: Array.from(ids, (id) => labelNames[id] || 'Background'),
    width: meta.width,
    height: meta.height,
  }
}

export function embedCastFaces(imagePath, faces) {
  const raw = execFileSync('py', ['-3', EMBED_PY], {
    input: JSON.stringify({ image: imagePath, faces }),
    encoding: 'utf8',
    timeout: 180000,
    cwd: ROOT,
  })
  return lastJson(raw)
}

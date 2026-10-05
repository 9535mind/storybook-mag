#!/usr/bin/env node
/**
 * 무과금. 그림 붙이기(파일·드롭·Ctrl+V·붙이기 단추)가 모든 영역에 연결됐는지 소스만 본다.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')
const fails = []

const html = read('public/index.html')
const attach = read('public/attach-image.js')
if (!html.includes('attach-image.js')) fails.push('index.html 에 attach-image.js 가 없습니다.')
if (!/globalThis\.StorymagAttach/.test(attach)) fails.push('StorymagAttach 가 없습니다.')
if (!/register:/.test(attach)) fails.push('register 가 없습니다.')
if (!/keydown/.test(attach) || !/key\.toLowerCase\(\) !== 'c'/.test(attach)) {
  fails.push('Ctrl+C 그림 복사가 없습니다.')
}

const wires = [
  ['public/free-studio.js', "StorymagAttach.register('free'"],
  ['public/free-studio.js', "bind($('free-text-drop')"],
  ['public/free-studio.js', "bind($('free-text')"],
  ['public/attach-image.js', 'looksImage'],
  ['public/observe.js', "StorymagAttach.register('observe'"],
  ['public/tale.js', "StorymagAttach.register('tale'"],
  ['public/essay.js', "StorymagAttach.register('essay'"],
  ['public/app.js', 'StorymagAttach?.route'],
]
for (const [file, needle] of wires) {
  if (!read(file).includes(needle)) fails.push(`${file} 에 ${needle} 가 없습니다.`)
}

const ids = [
  'free-photo-paste',
  'free-text-drop',
  'free-text-paste',
  'observe-image-paste',
  'tale-img-paste',
  'layout-image-paste',
  'essay-pdf-paste',
  'desk-cast-paste-w',
  'load-image-button',
]
for (const id of ids) {
  if (!html.includes(`id="${id}"`)) fails.push(`단추 ${id} 가 HTML 에 없습니다.`)
}

if (fails.length) {
  console.error('FAIL\n' + fails.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
console.log('attach-image wires connected')

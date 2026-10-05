#!/usr/bin/env node
/**
 * 무과금. 자유 스튜디오 몸매 투영이 전신 img2img 보다 얼굴 잠금 inpaint 를 먼저 타는지,
 * 움직임에서 줌·다른 얼굴을 막는 문장이 앞에 붙는지 본다.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fails = []
const refine = readFileSync(path.join(ROOT, 'functions/api/free-refine.ts'), 'utf8')
const client = readFileSync(path.join(ROOT, 'public/free-studio.js'), 'utf8')

const autoAt = refine.indexOf('const autoUndressInpaint')
const inpaintAt = refine.indexOf('runFacePreserveUndress')
const replAt = refine.lastIndexOf('refineReplicateImageToImage')
if (autoAt < 0 || inpaintAt < 0) fails.push('free-refine 에 얼굴 잠금 inpaint 가 없습니다.')
if (!(inpaintAt > autoAt && inpaintAt < replAt)) {
  fails.push('몸매 투영 inpaint 가 전신 img2img 보다 뒤에 있습니다.')
}
if (!/Mons: neat Korean-30s dark-brown CURLY patch/.test(refine)) {
  fails.push('몸매 투영 inpaint 에 치골 곱슬 음모 지시가 없습니다.')
}
if (!/finishPubicHair/.test(refine)) {
  fails.push('탈의 뒤에 음모 국소 손질이 없습니다.')
}

if (!/No zoom/.test(client)) fails.push('움직임에 줌 금지가 없습니다.')
if (!/bodyProject: couple \? undefined/.test(client)) {
  fails.push('커플 쇼츠에 몸매 투영 플래그를 그대로 보냅니다.')
}
if (/fal-kontext-couple-nude/.test(refine)) {
  fails.push('커플 정지화가 전신 Kontext로 얼굴을 바꿉니다.')
}
if (!/coupleClothes/.test(refine)) {
  fails.push('커플 영역 수정에 여자 옷 칸 프롬프트가 없습니다.')
}
if (!/커플은 여자 옷 칸을 연 뒤에만/.test(refine)) {
  fails.push('커플 텍스트 전신 경로를 막지 않았습니다.')
}
if (!/sourcePeople = photoFaces >= 2 \|\| coupleText \? 2 : 1/.test(client)) {
  fails.push('만들기에서 커플 인원을 서버에 보내지 않습니다.')
}
if (/resultNude && !couple/.test(client)) {
  fails.push('커플 나체 장에서 holdNude 를 건너뜁니다.')
}
if (!/sourceNude: state.resultNude/.test(client)) {
  fails.push('쇼츠가 이미 나체 장을 서버에 알리지 않습니다.')
}
if (!/womanClothesMask/.test(client)) {
  fails.push('만들기에서 여자 옷 칸 마스크를 만들지 않습니다.')
}
if (!/DeskLookOnnx\?\.parse/.test(client)) {
  fails.push('만들기에서 옷 파서를 쓰지 않습니다.')
}
if (/먼저 그림을 한 장 만든 다음/.test(client) || /먼저 그림을 한 장 만든 뒤/.test(client)) {
  fails.push('고치지 않은 사진으로 바로 쇼츠를 막습니다.')
}
if (!/올린 원본은 그대로/.test(client)) {
  fails.push('원본 칸을 건드리지 않는 안내가 없습니다.')
}
if (!/madeStill \? state\.result/.test(client) || !/await hostPhoto\(\)/.test(client)) {
  fails.push('쇼츠가 결과 장 또는 올린 사진을 시작 프레임으로 쓰지 않습니다.')
}

const animate = readFileSync(path.join(ROOT, 'functions/api/free-animate.ts'), 'utf8')
if (!/buildFreeCoupleVideoPrompt/.test(animate)) {
  fails.push('커플 쇼츠가 짧은 원본-얼굴 프롬프트를 쓰지 않습니다.')
}
if (!/alreadyNude: body.sourceNude === true/.test(animate)) {
  fails.push('커플 쇼츠가 나체 장인지 프롬프트에 안 넘깁니다.')
}
if (!/const coupleHint = body.sourcePeople === 2/.test(animate)) {
  fails.push('키스 말만으로 커플 프롬프트를 켭니다.')
}
if (/coupleHint = body.sourcePeople === 2 \|\| isFreeCoupleIntimateMotion/.test(animate)) {
  fails.push('얼굴 수 없이 커플 프롬프트를 켭니다.')
}
if (!/bodyProjectFlag =/.test(animate) || !/!isFreeCoupleIntimateMotion\(userMotion\)/.test(animate)) {
  fails.push('커플 키스에 몸매 투영 I2V 가 그대로 켜집니다.')
}
if (/same white studio/.test(readFileSync(path.join(ROOT, 'functions/lib/free-couple-lock.ts'), 'utf8').slice(
  readFileSync(path.join(ROOT, 'functions/lib/free-couple-lock.ts'), 'utf8').indexOf('export function buildFreeCoupleVideoPrompt'),
))) {
  fails.push('커플 쇼츠가 흰 스튜디오로 장소를 바꿉니다.')
}
if (!/CAST LOCK: I2V of THIS photo only/.test(animate)) {
  fails.push('혼자 쇼츠에 원본 얼굴 잠금이 없습니다.')
}
if (/sourcePeople: couple \? 2 : 1/.test(client) && /const couple =\s*photoFaces >= 2 \|\s*looksCoupleMotion/.test(client)) {
  fails.push('움직이기가 키스 말로 인원을 2로 올립니다.')
}
if (!/bathroom/.test(readFileSync(path.join(ROOT, 'functions/lib/free-couple-lock.ts'), 'utf8'))) {
  fails.push('커플 잠금에 욕실 금지가 없습니다.')
}
if (!/WIDE SHOT LOCK/.test(animate)) fails.push('free-animate 에 와이드 잠금이 없습니다.')
if (!/waist-down only crop/.test(animate)) fails.push('free-animate 에 허리 아래 크롭 금지가 없습니다.')

if (fails.length) {
  console.error('FAIL\n' + fails.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
console.log('free identity-lock ok')

import { createRequire } from 'module'
// scene-compiler is TS — duplicate minimal check by dynamic import won't work.
// Run wrangler-free sanity: copy logic via regex only.
const text = '제제가 거실에 엎드려 책을 보고 잇어요'
const polished = text.replace(/잇어요/g, '있어요')
const nameRe = /(?:^|[,\s])([가-힣]{2,8})([이가은는])(?=\s|$|[.!?…])/g
const m = nameRe.exec(polished)
console.log('polished', polished)
console.log('name', m && m[1])
console.log('living', /거실/.test(polished))
console.log('prone', /엎드/.test(polished))
console.log('book', /책/.test(polished))
console.log('hasTigerWord', /호랑이|tiger/i.test(polished))

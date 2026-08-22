# 나체 쇼츠 파이프라인 (최종 보관)

점검일: 2026-08-02 · 체크리스트 20/20 PASS

## 두 갈래

| 경로 | 진입 | 역할 |
|------|------|------|
| **일반 쇼츠** | 「쇼츠 비디오 만들기」 | 나체/유지, 딥키스, 가슴·보지 만지기, 애무, 서로 애무 |
| **몸매 투영** | 「몸매 투영」버튼 (`bodyProject: true`) | AI 타점 → 사용자 수정 → 옷 용해 완전 나체 |

서로 새지 않도록 격리:
- become 단축 프롬프트는 `bodyProject` 또는 유효 `landmarks`일 때만
- `sampleShift: 18`은 몸매 투영만
- 몸매 투영 종료 후 모션칸의 「몸매 투영」잔여 문구 자동 삭제
- refine 마커만으로 `motion='몸매 투영'` 주입하지 않음

## 일반 쇼츠 핵심

1. 클라이언트: `requestAnimate` → `POST /api/animate`
2. `resolveNudeIntent` → 탈의(`become`) / 유지(`hold`)
3. 키스·만짐·애무는 `leanIntimate` 짧은 BEAT 타임라인
4. `go_fast` OFF (모션·나체·탈의 시)
5. 팬티/포그 검열 대체 금지, 보지털(곱슬) 잠금은 hold/장문 경로에서 강화

모션 예: `누드`, `나체로`, `딥키스`, `가슴 만져`, `보지 만져`, `서로 애무`

## 몸매 투영 핵심

1. UI 타점: 흰 원 = 유방 중심(`mound`) · 빨간 점 = 유두(`nipple`, 원 중심과 독립)
2. `POST /api/body-landmarks` (Claude Vision)이 체형에 맞게 초안 제시
3. 사용자 드래그/미세조정 후 「이 타점으로 투영」
4. I2V 프롬프트: 짧은 BEAT + 타점 최전방 고정, 화보 옷 설명은 넣지 않음
5. 실패 모드 명시: 벨트 / 팬티·이중팬티 / 브라 잔존

## 주요 파일

- `functions/api/animate.ts` — I2V 진입, bodyProject 분기
- `functions/api/body-landmarks.ts` — AI 타점
- `functions/lib/content-policy.ts` — 프롬프트 분기·잠금
- `functions/lib/replicate-client.ts` — Wan `go_fast` / `sample_shift`
- `public/app.js` / `index.html` / `style.css` — 쇼츠 UI·타점 에디터

## 카메라 / 클로즈업

- **single (10~18초)**: 줌·얼굴 클로즈업·바스트 크롭 전면 금지. 소스와 동일 프레이밍.
- **dual-a 탈의/몸매투영**: 전반 와이드만. 나체 전 줌인 금지.
- **dual-b**: 나체 확인 후 후반에만 약한 줌. 「클로즈업으로 끝내」요청 시에만 클로즈 종결.
- `buildShortsCameraLock`이 become / leanIntimate / 장문 경로에 공통 적용 (조기 return이 카메라 잠금을 건너뛰지 않음).

## 운영 메모

- 몸매 투영과 키스/애무를 한 모션에 섞지 말 것 → 투영 후 별도 쇼츠로 동작
- 하드 리프레시 후 `app.js` 캐시 버전 확인

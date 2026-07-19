# 패션 매거진 스튜디오 (Storymag)

성인 전용 화보·자유 일러스트 생성 도구입니다.  
Cloudflare Pages + Pages Functions + D1 + Workers AI로 동작합니다.

## 인증

| 방식 | 설명 |
|------|------|
| **이메일 로그인** | D1 `users` / `sessions` |
| **회원가입** | **초대 코드 필수** (`SIGNUP_INVITE_CODE` 또는 fallback `ADMIN_PIN`) |
| **관리자 PIN** | 비상 입장 (`x-admin-pin`). 네트워크 실패 시 UI 우회 없음 |

권장: Cloudflare Access로 도메인 자체를 추가 게이트.

## 엔진 · 라우팅

| 모드 | 경로 |
|------|------|
| **패션 화보** | Juggernaut XL Lightning → 실패 시 Flux.2 Pro |
| **자유 · 실제 동물** | **Flux 우선** (금지 제약은 프롬프트에 bake) → 실패 시 Juggernaut |
| **자유 · 그 외** | Juggernaut → Flux |
| **성인 키워드** | fal 스킵(거절 다수) → Juggernaut |

자유 모드 프롬프트는 `functions/lib/scene-compiler.ts`가 **단일 소스**입니다.

## 생성 품질 보조

- 가이드 슬롯(주부·술부 → 형용사·목적어·보어)
- AI 도움: **조언 → 클릭 시 작성** (조언을 fill에 전달)
- **생성 전 장면 읽기** (`/api/scene-preview`, 휴리스틱)
- 실제동물 / 반인반수(명시 시에만) 분기
- 시간당 요청 한도(D1 rate limit)

## 숏폼 영상(I2V)

`/api/animate` — Replicate Wan2.2 I2V. 이미지 생성과 분리.  
갤러리·YouTube Shorts 초안은 브라우저 localStorage.

## 빠른 시작

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# ADMIN_PIN, REPLICATE_API_TOKEN, FAL_KEY, (선택) SIGNUP_INVITE_CODE
npm run db:migrate
npm run db:migrate:rate
npm run dev
```

## 배포

```powershell
npx wrangler pages deploy public --project-name=storymag
```

환경 변수(Production): `ADMIN_PIN`, `SIGNUP_INVITE_CODE`(권장), `REPLICATE_API_TOKEN`, `FAL_KEY`, D1 바인딩.

```powershell
npm run db:migrate
npm run db:migrate:rate
```

## 콘텐츠 정책 (코드 기준)

`evaluateContentPolicy` **하드 차단**:

- 미성년·아동 관련
- 비동의 성적 상황
- 실존 인물 딥페이크성 지칭

그 외 성인 화보/누드/에로는 앱 정책상 허용(엔진 자체 필터는 별개).

## 구조

```
public/                 프론트 (게이트·가이드·갤러리·영상)
functions/api/          generate, refine, animate, assist, scene-preview, auth/*
functions/lib/          scene-compiler, content-policy, rate-limit, media-url, clients
migrations/             D1 스키마
```

- 갤러리 URL은 제공자 CDN — 만료될 수 있음  
- refine/animate `imageUrl`은 허용 호스트만  
- `demo-output/`은 로컬 실험용(gitignore)

# 메일 트리아지 대시보드

## 프로젝트 개요
- 고객 수신 메일을 분류·SLA·감정·담당부서 기준으로 분석하는 읽기 전용 대시보드. 시트 헤더/값에서 컬럼 타입을 자동 추론해 시각화를 구성한다.
- 운영 주소: https://mail-dashboard-blue-six.vercel.app (저장소 homepage·`app/layout.tsx`)
- 데이터: Google Sheets. 서비스 계정 미설정 시 공개 CSV fallback.

## 기술 스택
- Next.js 15 (App Router, TypeScript) · React 19 · next-auth v5 beta(Google OAuth) · googleapis(Sheets v4) · Tailwind CSS v4

## 구조
| 경로 | 역할 |
|---|---|
| `app/page.tsx` · `app/layout.tsx` · `app/globals.css` | 진입·메타데이터·테마 토큰 |
| `app/api/data/route.ts` | 데이터 API |
| `app/api/auth/[...nextauth]/route.ts` · `auth.ts` · `middleware.ts` | 인증(미설정 시 우회) |
| `app/actions.ts` | 로그인/로그아웃 서버 액션 |
| `components/Dashboard.tsx` | 대시보드 화면(대형 파일) |
| `components/IntroGate.tsx` · `components/Logo.tsx` | 인트로/게스트 게이트·로고 |
| `lib/sheets.ts` · `lib/schema-infer.ts` · `lib/analyze.ts` | 시트 수집·스키마 추론·집계 |

## 명령 (package.json)
- `npm run dev` (turbopack) · `npm run build` · `npm run start` · `npm run lint`

## 작업 규칙
- 모든 변경은 브랜치 → PR. main 병합·운영 배포는 사용자 승인 후에만.
- API 키·`.env`·서비스 계정 JSON·개인정보·기밀 커밋 금지. 지어낸 수치·실적 금지.
- 사용자 보고는 한국어로 간결하게.

## 디자인 기준 (커밋 기록 기준)
- 웜 라이트 기본 + 다크/라이트 토글(`:root[data-theme="dark"]`). 글꼴 Pretendard·Newsreader(`app/layout.tsx`).
- 제작자 표기(포트폴리오 연결)는 유지한다.

## 테스트·배포 정책
- 테스트 스크립트 없음. 변경 후 `npm run build` 통과 필수.
- `npm run lint`는 현재 실패(기존 문제, docs/WORKLOG.md 참고). `next.config.ts`에서 빌드 중 ESLint는 건너뜀.

## 세션 시작 시 할 일
- `docs/WORKLOG.md` 를 먼저 읽고 '진행 중'부터 이어간다. 작업을 마치면 WORKLOG를 갱신한다.

## 클라우드 환경 변수 (이름만, 코드 기준)
- `GOOGLE_SERVICE_ACCOUNT_JSON` · `GOOGLE_SHEETS_ID` · `GOOGLE_SHEET_TAB` · `GOOGLE_SHEET_GID`
- `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `ALLOWED_HOSTED_DOMAINS` · `NEXTAUTH_SECRET` (README에는 `NEXTAUTH_URL`도 있음)
- 모두 없어도 빌드는 된다(인증 우회·공개 CSV fallback).

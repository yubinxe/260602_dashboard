# 메일 트리아지 대시보드

고객 수신 메일을 분류·SLA·감정·담당부서 기준으로 분석하는 읽기 전용 대시보드.
시트 스키마는 **고정이 아니며**, 헤더/값에서 컬럼 타입을 자동 추론(STEP 0)해
시각화를 자동 구성(STEP 2)한다.

---

## STEP 0 — 시트 컬럼 매핑 결과 (자동 추론)

300건 티켓 · 18개 컬럼

| 컬럼명 | 추론 타입 | 시각화 |
|--------|-----------|--------|
| 티켓ID | id | 테이블 |
| 최근수신(KST) | **datetime** | 스파크라인 + 요일×시간 히트맵 |
| 경과(일) | numeric | 테이블 |
| 발신자 | **email** | Top 도메인/발신자 랭킹 |
| 발신자유형 | category | 도넛 (외부고객·자동/마케팅·내부) |
| 언어 | category | 도넛 (KO·EN·ZH) |
| 분류 | category | 도넛 (8종) |
| 담당부서 | category | 도넛 (7개 팀) |
| 중요도 | numeric | 분포 바 (1~9) |
| 감정 | category | 도넛 (중립·긍정·부정) |
| SLA기한 | **datetime** | — |
| 지연 | **flag** | KPI · 검토카드 배지 |
| 처리상태 | category | 도넛 (4종) |
| 회신여부 | category | KPI(미회신) · 도넛 |
| 검토필요 | **flag** | KPI · 검토 뷰 필터 |
| AI회신초안/조치 | **longtext** | 검토 뷰 카드 |
| Gmail링크 | **url** | 링크 버튼 |
| Draft상태 | freetext | 테이블 |

- **시트 ID**: `1zVrJhs_0sB3wSP-vpV23usjBfS7zfPeBi8oTx_jZ9qw`
- **탭**: `dummy mail data의 사본` (GID: `262406245`)
- **인증 방식**: 서비스 계정 (JWT) → 미설정 시 공개 CSV fallback 자동 사용

---

## 환경 변수 설정 (`.env.local`)

```env
# Google Sheets 읽기 (서비스 계정 JSON을 한 줄로)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

# 시트 정보
GOOGLE_SHEETS_ID=1zVrJhs_0sB3wSP-vpV23usjBfS7zfPeBi8oTx_jZ9qw
GOOGLE_SHEET_TAB=dummy mail data
GOOGLE_SHEET_GID=1234434521

# Google OAuth (로그인, 선택 — 미설정 시 인증 우회)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# 허용 도메인 (빈값이면 모두 허용)
ALLOWED_HOSTED_DOMAINS=gmail.com,naver.com

# NextAuth
NEXTAUTH_SECRET=랜덤_32자_이상_문자열
NEXTAUTH_URL=http://localhost:3000
```

---

## 서비스 계정 설정 가이드 (Google Sheets 읽기)

1. [Google Cloud Console](https://console.cloud.google.com) 접속 → 프로젝트 선택
2. **API 및 서비스** → **라이브러리** → **Google Sheets API** 활성화
3. **IAM 및 관리자** → **서비스 계정** → **서비스 계정 만들기**
4. 키 만들기 → **JSON** 다운로드
5. JSON 파일 내용을 **한 줄**로 압축:
   ```bash
   cat service-account.json | tr -d '\n'
   ```
6. 압축된 JSON을 `GOOGLE_SERVICE_ACCOUNT_JSON` 값으로 설정
7. Google Sheets 문서 → 공유 → 서비스 계정 이메일 추가 (뷰어 권한)

> 시트가 공개 링크로 공유된 경우 서비스 계정 없이 공개 CSV fallback이 자동 사용됩니다.

---

## OAuth 로그인 설정 가이드 (선택)

1. Google Cloud Console → **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 2.0 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. **승인된 리디렉션 URI** 추가:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.vercel.app/api/auth/callback/google`
5. 클라이언트 ID/Secret을 `.env.local`에 입력

> `GOOGLE_CLIENT_ID` 미설정 시 인증을 자동으로 우회합니다 (개발 모드).

---

## 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 기술 스택

- **Next.js 15** (App Router, TypeScript)
- **next-auth v5 beta** (Google OAuth, 미들웨어 보호)
- **googleapis** (Sheets API v4, 서비스 계정)
- **Tailwind CSS v4** + OKLCH 다크 테마

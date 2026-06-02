# 수강생 제출 현황 대시보드

AI 교육 수강생의 일차별 URL 제출 현황을 실시간으로 확인하는 읽기 전용 대시보드.

---

## STEP 0 — 시트 컬럼 매핑 결과

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| no | numeric | 행 번호 |
| 이름 | freetext | 참가자 이름 |
| 이메일 | email | 이메일 주소 |
| 1일차 URL | url | 1일차 배포 URL |
| 2일차 URL (오전) | url | 2일차 오전 배포 URL |
| 3일차 URL | url | 3일차 배포 URL |

- **시트 ID**: `1zVrJhs_0sB3wSP-vpV23usjBfS7zfPeBi8oTx_jZ9qw`
- **탭**: `dummy mail data` (GID: `1234434521`)
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

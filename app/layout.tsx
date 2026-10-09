import type { Metadata } from 'next'
import './globals.css'

const PORTFOLIO = 'https://yubinxe.github.io/Portfolio/'

export const metadata: Metadata = {
  title: '메일 트리아지 대시보드',
  description: '고객 수신 메일 분류·SLA·감정 분석 읽기 전용 대시보드. 김유빈(Yubin Kim) 기획·개발.',
  authors: [{ name: '김유빈 (Yubin Kim)', url: PORTFOLIO }],
  creator: '김유빈 (Yubin Kim)',
}

/** 제작자 연결 — 포트폴리오의 Person(@id)과 같은 사람으로 묶는다. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '메일 트리아지 대시보드 — Google Workspace 연동 VOC 트리아지',
  url: 'https://mail-dashboard-blue-six.vercel.app/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'ko-KR',
  creator: { '@type': 'Person', '@id': PORTFOLIO + '#person', name: '김유빈', alternateName: 'Yubin Kim', url: PORTFOLIO },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard (본문/데이터) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        {/* Newsreader (세리프 포인트 — 숫자/워드마크/eyebrow) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('mt-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
      </body>
    </html>
  )
}

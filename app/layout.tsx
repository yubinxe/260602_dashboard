import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '메일 트리아지 대시보드',
  description: '고객 수신 메일 분류·SLA·감정 분석 읽기 전용 대시보드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

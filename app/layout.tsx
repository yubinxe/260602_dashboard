import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '수강생 제출 현황 대시보드',
  description: 'AI 교육 수강생 URL 제출 현황 읽기 전용 대시보드',
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

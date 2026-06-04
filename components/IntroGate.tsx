'use client'

import { useEffect, useState } from 'react'
import type { ColumnType } from '../lib/schema-infer'
import type { SheetRow } from '../lib/sheets'
import Dashboard from './Dashboard'
import { LogoMark } from './Logo'

interface Data {
  headers: string[]
  rows: SheetRow[]
  schema: Record<string, ColumnType>
  fetchedAt: string
}

type Phase = 'loading' | 'gate' | 'app'

export default function IntroGate({
  data,
  authed,
  account,
  login,
  logout,
}: {
  data: Data
  authed: boolean
  account?: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [guest, setGuest] = useState(false)
  const [closing, setClosing] = useState(false)

  // route after the brand loading animation
  useEffect(() => {
    // returning within the same session → skip the intro
    try {
      if (sessionStorage.getItem('mt_phase') === 'app') {
        setGuest(sessionStorage.getItem('mt_guest') === '1')
        setPhase('app')
        return
      }
    } catch {}
    const t = setTimeout(() => {
      if (authed) {
        enter(false)
      } else {
        setClosing(true)
        setTimeout(() => setPhase('gate'), 420)
      }
    }, authed ? 1300 : 1850)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  const enter = (asGuest: boolean) => {
    setGuest(asGuest)
    try {
      sessionStorage.setItem('mt_phase', 'app')
      sessionStorage.setItem('mt_guest', asGuest ? '1' : '0')
    } catch {}
    setPhase('app')
  }

  const handleSignOut = () => {
    try {
      sessionStorage.removeItem('mt_phase')
      sessionStorage.removeItem('mt_guest')
    } catch {}
    if (guest || !authed) {
      setGuest(false)
      setPhase('gate')
    } else {
      void logout()
    }
  }

  if (phase === 'app') {
    return (
      <div className="app-enter">
        <Dashboard {...data} guest={guest} account={account} onSignOut={handleSignOut} />
      </div>
    )
  }

  // ── full-screen overlay (loading + gate) ──────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
      }}
    >
      {phase === 'loading' ? (
        <LoadingScene closing={closing} />
      ) : (
        <GateScene login={login} onGuest={() => enter(true)} />
      )}

      <div className="eyebrow" style={{ position: 'absolute', bottom: 28, color: 'var(--ink-4)' }}>
        Mail Triage · 메일 트리아지 대시보드
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Loading scene — brand reveal
// ════════════════════════════════════════════════════════════════════════════
function LoadingScene({ closing }: { closing: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        animation: closing ? 'curtain 0.42s ease forwards' : 'fadeIn 0.5s ease both',
      }}
    >
      {/* logo inside a sweeping progress ring */}
      <div style={{ position: 'relative', width: 116, height: 116, display: 'grid', placeItems: 'center' }}>
        <svg width={116} height={116} viewBox="0 0 116 116" style={{ position: 'absolute', inset: 0 }}>
          <circle cx={58} cy={58} r={45} fill="none" stroke="var(--line)" strokeWidth={2} />
          <circle
            cx={58}
            cy={58}
            r={45}
            fill="none"
            stroke="var(--mustard)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={283}
            transform="rotate(-90 58 58)"
            style={{ animation: 'ringSweep 1.5s cubic-bezier(0.5,0,0.2,1) infinite' }}
          />
        </svg>
        <div style={{ animation: 'breathe 1.8s ease-in-out infinite' }}>
          <LogoMark size={52} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span className="serif" style={{ fontSize: 27, fontWeight: 500, letterSpacing: '-0.02em', animation: 'fadeUp 0.7s 0.15s cubic-bezier(0.22,0.61,0.36,1) both' }}>
          Mail&nbsp;Triage
        </span>
        <span className="eyebrow" style={{ animation: 'fadeUp 0.7s 0.3s cubic-bezier(0.22,0.61,0.36,1) both' }}>
          오늘의 수신함을 정리하는 중
        </span>
      </div>

      {/* rising dots */}
      <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dot"
            style={{ width: 7, height: 7, background: 'var(--ink-4)', animation: `riseDot 1.1s ${i * 0.16}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Gate scene — Google login + guest
// ════════════════════════════════════════════════════════════════════════════
function GateScene({ login, onGuest }: { login: () => Promise<void>; onGuest: () => void }) {
  return (
    <div
      className="card anim-in"
      style={{
        width: '100%',
        maxWidth: 412,
        padding: '40px 36px 34px',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--sh-3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <LogoMark size={56} />
      <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 20 }}>
        메일 트리아지
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 8, maxWidth: 300 }}>
        고객 수신 메일을 분류·SLA·감정으로 한눈에.
        <br />
        팀 계정으로 로그인해 시작하세요.
      </p>

      {/* Google login */}
      <form action={login} style={{ width: '100%', marginTop: 26 }}>
        <button
          type="submit"
          className="btn"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '13px 18px',
            fontSize: 14,
            background: 'var(--paper)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
            cursor: 'pointer',
          }}
        >
          <GoogleG />
          Google로 계속하기
        </button>
      </form>

      {/* divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '18px 0' }}>
        <hr className="hairline" style={{ flex: 1 }} />
        <span className="eyebrow" style={{ color: 'var(--ink-4)' }}>또는</span>
        <hr className="hairline" style={{ flex: 1 }} />
      </div>

      {/* guest */}
      <button
        onClick={onGuest}
        className="btn btn-ghost"
        style={{ width: '100%', padding: '13px 18px', fontSize: 14, cursor: 'pointer' }}
      >
        게스트로 둘러보기
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 12 }}>
        게스트는 집계 지표만 볼 수 있어요. 개별 메일·이메일 주소·AI 회신초안 등<br />민감 정보는 로그인 후 공개됩니다.
      </p>
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

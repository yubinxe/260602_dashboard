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
        overflow: 'hidden',
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
  const chips: [string, string][] = [
    ['자동 분류', 'var(--olive)'],
    ['SLA 추적', 'var(--terracotta)'],
    ['감정 분석', 'var(--mustard)'],
  ]
  return (
    <>
      {/* ambient drifting blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
        <span className="blob" style={{ width: 380, height: 380, top: '-7%', left: '-5%', background: 'color-mix(in srgb, var(--mustard) 55%, transparent)', animation: 'drift 17s ease-in-out infinite' }} />
        <span className="blob" style={{ width: 340, height: 340, bottom: '-9%', right: '-5%', background: 'color-mix(in srgb, var(--terracotta) 50%, transparent)', animation: 'drift 21s ease-in-out infinite reverse' }} />
        <span className="blob" style={{ width: 300, height: 300, top: '34%', right: '20%', background: 'color-mix(in srgb, var(--olive) 45%, transparent)', opacity: 0.38, animation: 'drift 24s ease-in-out infinite' }} />
      </div>

      {/* floating mini data-viz (desktop) */}
      <DecoDonut style={{ top: '17%', left: '11%', ['--rot' as string]: '-9deg' }} />
      <DecoKpi style={{ top: '21%', right: '12%', ['--rot' as string]: '7deg' }} />
      <DecoSpark style={{ bottom: '17%', right: '10%', ['--rot' as string]: '5deg' }} />
      <DecoMood style={{ bottom: '20%', left: '12%', ['--rot' as string]: '-6deg' }} />

      {/* frosted auth card */}
      <div
        className="anim-in"
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 440,
          padding: '44px 40px 36px',
          borderRadius: 'var(--r-xl)',
          background: 'color-mix(in srgb, var(--paper) 78%, transparent)',
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          border: '1px solid color-mix(in srgb, var(--mustard) 16%, var(--line))',
          boxShadow: 'var(--sh-3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ animation: 'breathe 4s ease-in-out infinite' }}>
          <LogoMark size={58} />
        </div>
        <span className="eyebrow" style={{ marginTop: 18, color: 'var(--mustard)', fontSize: 13.5 }}>
          Inbox, beautifully triaged
        </span>
        <h1 className="serif" style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.12 }}>
          메일 트리아지
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.75, marginTop: 12, maxWidth: 322 }}>
          고객 수신 메일을 분류·SLA·감정으로 한눈에.
          <br />
          오늘의 받은편지함을 우아하게 정리하세요.
        </p>

        {/* feature chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 18 }}>
          {chips.map(([t, c]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 11%, var(--paper))`, border: `1px solid color-mix(in srgb, ${c} 24%, var(--line))` }}>
              <span className="dot" style={{ width: 5, height: 5, background: c }} />
              {t}
            </span>
          ))}
        </div>

        {/* live teaser */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: 'var(--ink-3)' }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="dot" style={{ width: 6, height: 6, background: 'var(--sage)', animation: `riseDot 1.1s ${i * 0.16}s ease-in-out infinite` }} />
            ))}
          </span>
          지금 <b className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>300건</b> 분석 준비 완료
        </div>

        {/* Google */}
        <form action={login} style={{ width: '100%', marginTop: 24 }}>
          <button type="submit" className="btn linkpill" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 18px', fontSize: 14.5, background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)', cursor: 'pointer', fontWeight: 600 }}>
            <GoogleG />
            Google로 계속하기
          </button>
        </form>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '16px 0' }}>
          <hr className="hairline" style={{ flex: 1 }} />
          <span className="eyebrow" style={{ color: 'var(--ink-4)' }}>또는</span>
          <hr className="hairline" style={{ flex: 1 }} />
        </div>

        {/* Guest */}
        <button onClick={onGuest} className="btn linkpill" style={{ width: '100%', padding: '14px 18px', fontSize: 14.5, cursor: 'pointer', fontWeight: 600, color: 'var(--mustard-deep)', background: 'color-mix(in srgb, var(--mustard) 13%, var(--paper))', border: '1px solid color-mix(in srgb, var(--mustard) 30%, var(--line))' }}>
          ✦ 게스트로 둘러보기
        </button>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 12 }}>
          게스트는 집계 지표만 볼 수 있어요. 개별 메일·이메일 주소·AI 회신초안 등
          <br />
          민감 정보는 로그인 후 공개됩니다.
        </p>
      </div>
    </>
  )
}

function DecoDonut({ style }: { style: React.CSSProperties }) {
  const C = 2 * Math.PI * 16
  const segs: [number, string][] = [[0.42, 'var(--chart-1)'], [0.28, 'var(--chart-2)'], [0.18, 'var(--chart-3)'], [0.12, 'var(--chart-4)']]
  let off = 0
  return (
    <div className="gate-deco gate-glass" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 11, animation: 'floaty 7s ease-in-out infinite', ...style }}>
      <svg width={46} height={46} viewBox="0 0 46 46">
        <circle cx={23} cy={23} r={16} fill="none" stroke="var(--oat)" strokeWidth={6} />
        {segs.map(([f, c], i) => {
          const len = f * C
          const el = <circle key={i} cx={23} cy={23} r={16} fill="none" stroke={c} strokeWidth={6} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 23 23)" />
          off += len
          return el
        })}
      </svg>
      <div style={{ textAlign: 'left' }}>
        <div className="microlabel" style={{ fontSize: 9.5 }}>분류</div>
        <div className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>8종</div>
      </div>
    </div>
  )
}

function DecoKpi({ style }: { style: React.CSSProperties }) {
  return (
    <div className="gate-deco gate-glass" style={{ padding: '13px 17px', textAlign: 'left', animation: 'floaty 6.5s ease-in-out infinite', ...style }}>
      <div className="microlabel" style={{ fontSize: 9.5 }}>미회신</div>
      <div className="num" style={{ fontSize: 28, color: 'var(--olive)', lineHeight: 1, marginTop: 3 }}>228</div>
    </div>
  )
}

function DecoSpark({ style }: { style: React.CSSProperties }) {
  return (
    <div className="gate-deco gate-glass" style={{ padding: '12px 14px', width: 138, animation: 'floaty 8s ease-in-out infinite', ...style }}>
      <div className="microlabel" style={{ fontSize: 9.5, marginBottom: 7 }}>수신 추이</div>
      <svg width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none">
        <polyline points="0,25 14,17 28,21 42,9 56,15 70,5 84,13 100,7" fill="none" stroke="var(--dusty)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function DecoMood({ style }: { style: React.CSSProperties }) {
  return (
    <div className="gate-deco gate-glass" style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 9, animation: 'floaty 7.5s ease-in-out infinite', ...style }}>
      <span className="serif" style={{ fontSize: 19, color: 'var(--sage)' }}>◠‿◠</span>
      <div style={{ textAlign: 'left' }}>
        <div className="microlabel" style={{ fontSize: 9.5 }}>감정</div>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>긍정적</div>
      </div>
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

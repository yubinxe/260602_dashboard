'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import type { ColumnType } from '../lib/schema-infer'
import { groupColumnsByType } from '../lib/schema-infer'
import type { SheetRow } from '../lib/sheets'
import { LogoMark, Wordmark } from './Logo'
import {
  dailyVolume,
  heatmapMatrix,
  matrixMax,
  categoryCounts,
  domainRanking,
  senderRanking,
  extractName,
  extractEmail,
  extractDomain,
  accentFor,
  type CatCount,
} from '../lib/analyze'

interface Props {
  headers: string[]
  rows: SheetRow[]
  schema: Record<string, ColumnType>
  fetchedAt: string
  guest?: boolean
  account?: string | null
  onSignOut?: () => void
}

interface Filter {
  key: string
  label: string
  test: (r: SheetRow) => boolean
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const C_INK = 'var(--ink)'

// ════════════════════════════════════════════════════════════════════════════
// Hooks
// ════════════════════════════════════════════════════════════════════════════
function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return m
}

function useCountUp(target: number, dur = 950): number {
  const [v, setV] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    prev.current = target
    if (from === target) {
      setV(target)
      return
    }
    let raf = 0
    let start: number | null = null
    const tick = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setV(target)
    }
    raf = requestAnimationFrame(tick)
    const guard = setTimeout(() => setV(target), dur + 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(guard)
    }
  }, [target, dur])
  return v
}

// ════════════════════════════════════════════════════════════════════════════
// Emoji + masking
// ════════════════════════════════════════════════════════════════════════════
function emojiFor(value: string): string {
  const map: Record<string, string> = {
    긍정: '☺', 중립: '·', 부정: '✕',
    조치필요: '◆', '신규(대기)': '○', 회신완료: '✓', 미회신: '⏳', 자동분류: '⚙',
    외부고객: '◇', '자동/마케팅': '◈', 내부: '▣',
    지연: '!', 검토필요: '◉',
    KO: 'KR', EN: 'EN', ZH: 'ZH',
  }
  return map[value.trim()] ?? ''
}

function maskEmailDisplay(raw: string): string {
  const name = extractName(raw)
  const dom = extractDomain(raw)
  return dom ? `${name} ·••@${dom}` : name
}

// ════════════════════════════════════════════════════════════════════════════
// Atoms
// ════════════════════════════════════════════════════════════════════════════
function Pill({
  label, accent, title, onClick, active, glyph,
}: {
  label: string; accent: string; title?: string; onClick?: () => void; active?: boolean; glyph?: boolean
}) {
  const g = glyph ? emojiFor(label) : ''
  return (
    <span
      title={title ?? label}
      onClick={onClick}
      className={`chip${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
      style={{
        ['--c' as string]: accent,
        padding: '4px 11px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        background: `color-mix(in srgb, ${accent} 12%, var(--paper))`,
        color: accent,
        border: `1px solid color-mix(in srgb, ${accent} 26%, var(--line))`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: 280,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      <span className="dot" style={{ width: 5.5, height: 5.5, background: accent, flexShrink: 0 }} />
      {g && <span style={{ fontSize: 11, opacity: 0.85 }}>{g}</span>}
      {label}
    </span>
  )
}

function Eyebrow({ en, ko, accent, big }: { en: string; ko: string; accent: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
      <span className="dot" style={{ width: 8, height: 8, background: accent, transform: 'translateY(-1px)' }} />
      <span className="eyebrow" style={{ color: accent, fontSize: big ? 14 : 13 }}>{en}</span>
      <span className="microlabel" style={{ fontSize: 11.5 }}>{ko}</span>
    </div>
  )
}

function Strong({ children, color }: { children: React.ReactNode; color: string }) {
  return <strong style={{ color, fontWeight: 600 }}>{children}</strong>
}

// ════════════════════════════════════════════════════════════════════════════
// KPI card
// ════════════════════════════════════════════════════════════════════════════
function KPICard({
  en, label, value, unit, accent, delay, onClick, active,
}: {
  en: string; label: string; value: number; unit?: string; accent: string; delay: number; onClick?: () => void; active?: boolean
}) {
  const animated = useCountUp(value)
  return (
    <div
      onClick={onClick}
      className="card lift kpi anim"
      style={{
        ['--c' as string]: accent,
        animationDelay: `${delay}ms`,
        padding: '24px 24px 22px',
        borderRadius: 'var(--r-lg)',
        borderColor: active ? `color-mix(in srgb, ${accent} 48%, var(--line))` : undefined,
        boxShadow: active ? 'var(--sh-2)' : undefined,
      }}
    >
      <Eyebrow en={en} ko={label} accent={accent} />
      <div className="kpi-num" style={{ fontSize: 52, fontWeight: 500, color: accent, lineHeight: 1, marginTop: 18 }}>
        {animated.toLocaleString()}
      </div>
      {unit && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 9, fontWeight: 500 }}>{unit}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Section
// ════════════════════════════════════════════════════════════════════════════
function Section({
  id, en, title, accent, isOpen, onToggle, meta, delay, innerRef, children,
}: {
  id?: string; en: string; title: string; accent: string; isOpen: boolean; onToggle: () => void
  meta?: string; delay: number; innerRef?: React.RefObject<HTMLDivElement | null>; children: React.ReactNode
}) {
  return (
    <div
      id={id}
      ref={innerRef}
      className="card anim"
      style={{ animationDelay: `${delay}ms`, marginBottom: 16, borderRadius: 'var(--r-lg)', overflow: 'hidden', scrollMarginTop: 88 }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: isOpen ? 'color-mix(in srgb, var(--oat) 55%, transparent)' : 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--ink)', transition: 'background 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="eyebrow" style={{ color: accent, fontSize: 14 }}>{en}</span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</span>
          {meta && <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 12.5 }}>{meta}</span>}
        </span>
        <span className={`caret${isOpen ? ' open' : ''}`} style={{ fontSize: 11, color: 'var(--ink-3)' }}>▶</span>
      </button>
      {isOpen && (
        <>
          <hr className="hairline" style={{ margin: '0 24px' }} />
          <div className="section-body" style={{ padding: '22px 24px 24px' }}>{children}</div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Donut (size-aware, animated, clickable)
// ════════════════════════════════════════════════════════════════════════════
function Donut({
  col, data, accent, onPick, activeValue, mounted, big,
}: {
  col: string; data: CatCount[]; accent: string; onPick: (value: string) => void; activeValue?: string; mounted: boolean; big?: boolean
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const top = data.slice(0, big ? 10 : 6)
  const r = 52
  const C = 2 * Math.PI * r
  const sw = big ? 18 : 16
  const size = big ? 150 : 128
  let offset = 0

  return (
    <div className="card" style={{ ['--c' as string]: accent, padding: big ? '22px' : '18px', borderRadius: 'var(--r)', height: '100%' }}>
      <Eyebrow en="category" ko={col} accent={accent} big={big} />
      <div style={{ display: 'flex', gap: big ? 22 : 16, alignItems: 'center', marginTop: 16, flexWrap: big ? 'nowrap' : 'wrap' }}>
        <svg width={size} height={size} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--oat)" strokeWidth={sw} />
          {top.map((d, i) => {
            const frac = total ? d.count / total : 0
            const len = frac * C
            const dash = mounted ? `${len} ${C - len}` : `0 ${C}`
            const dim = activeValue !== undefined && activeValue !== d.label
            const el = (
              <circle
                key={d.label}
                className={`donut-slice${dim ? ' dim' : ''}`}
                cx={70} cy={70} r={r} fill="none"
                stroke={accentFor(i)}
                strokeWidth={activeValue === d.label ? sw + 5 : sw}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                strokeLinecap="butt"
                onClick={() => onPick(d.label)}
              >
                <title>{`${d.label}: ${d.count}건 (${total ? Math.round((d.count / total) * 100) : 0}%)`}</title>
              </circle>
            )
            offset += len
            return el
          })}
          <text x={70} y={66} textAnchor="middle" fontSize={32} fontWeight={500} fill="var(--ink)" fontFamily="var(--serif)">{total}</text>
          <text x={70} y={88} textAnchor="middle" fontSize={11} fill="var(--ink-3)" letterSpacing="0.12em">건</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: big ? 3 : 2, minWidth: 0, columns: big && top.length > 5 ? 2 : 1 }}>
          {top.map((d, i) => {
            const dim = activeValue !== undefined && activeValue !== d.label
            const gl = emojiFor(d.label)
            return (
              <div key={d.label} className={`legend-row${dim ? ' dim' : ''}`} onClick={() => onPick(d.label)} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, breakInside: 'avoid' }}>
                <span className="dot" style={{ width: 10, height: 10, background: accentFor(i), flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={d.label}>
                  {gl && <span style={{ marginRight: 4, color: 'var(--ink-3)', fontSize: 11 }}>{gl}</span>}
                  {d.label}
                </span>
                <span className="num" style={{ color: 'var(--ink)', fontSize: 15 }}>{d.count}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: 11.5, width: 38, textAlign: 'right' }}>{total ? Math.round((d.count / total) * 100) : 0}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Mood tile (sentiment) — Insta-friendly featured tile
// ════════════════════════════════════════════════════════════════════════════
const MOOD_FACE: Record<string, { face: string; accent: string }> = {
  긍정: { face: '◠‿◠', accent: 'var(--sage)' },
  중립: { face: '−‿−', accent: 'var(--dusty)' },
  부정: { face: '◞﹏◟', accent: 'var(--terracotta)' },
}

function MoodTile({ col, data, total, onPick, activeValue }: { col: string; data: CatCount[]; total: number; onPick: (v: string) => void; activeValue?: string }) {
  const top = data.find((d) => d.label.includes('긍정')) ?? data[0]
  const order = ['긍정', '중립', '부정']
  const sorted = [...data].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
  return (
    <div className="card" style={{ ['--c' as string]: 'var(--sage)', padding: '22px', borderRadius: 'var(--r)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(165deg, color-mix(in srgb, var(--sage) 7%, var(--paper)), var(--paper))' }}>
      <Eyebrow en="mood" ko={col} accent="var(--sage)" big />
      <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
        <div style={{ fontSize: 38, color: (MOOD_FACE[top?.label]?.accent ?? 'var(--ink)'), letterSpacing: 2, fontFamily: 'var(--serif)' }}>
          {MOOD_FACE[top?.label]?.face ?? '·‿·'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 8, fontWeight: 500 }}>
          가장 많은 감정 — <Strong color={MOOD_FACE[top?.label]?.accent ?? 'var(--ink)'}>{top?.label} {total ? Math.round((top.count / total) * 100) : 0}%</Strong>
        </div>
      </div>
      {/* stacked ratio bar */}
      <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', marginTop: 12, border: '1px solid var(--line)' }}>
        {sorted.map((d) => (
          <div key={d.label} title={`${d.label} ${d.count}건`} onClick={() => onPick(d.label)} style={{ width: `${total ? (d.count / total) * 100 : 0}%`, background: MOOD_FACE[d.label]?.accent ?? 'var(--sand)', cursor: 'pointer', opacity: activeValue && activeValue !== d.label ? 0.4 : 1, transition: 'opacity 0.2s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
        {sorted.map((d) => (
          <button key={d.label} onClick={() => onPick(d.label)} className="legend-row" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>{d.label}</span>
            <span className="num" style={{ fontSize: 17, color: MOOD_FACE[d.label]?.accent ?? 'var(--ink)' }}>{d.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Importance strip — full-width column chart (distinct treatment)
// ════════════════════════════════════════════════════════════════════════════
function ImportanceStrip({ col, data, mounted, onPick, activeValue }: { col: string; data: CatCount[]; mounted: boolean; onPick: (v: string) => void; activeValue?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="card" style={{ ['--c' as string]: 'var(--mustard)', padding: '22px 24px', borderRadius: 'var(--r)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow en="priority" ko={`${col} 분포`} accent="var(--mustard)" big />
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>막대를 클릭해 필터 · 높을수록 중요</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginTop: 20 }}>
        {data.map((d) => {
          const score = Number(d.label) || 0
          const h = (d.count / max) * 100
          const dim = activeValue !== undefined && activeValue !== d.label
          // sand → mustard → terracotta by score
          const t = Math.min(1, score / 9)
          const color = t < 0.5 ? `color-mix(in srgb, var(--sand) ${100 - t * 140}%, var(--mustard))` : `color-mix(in srgb, var(--mustard) ${100 - (t - 0.5) * 120}%, var(--terracotta))`
          return (
            <div key={d.label} onClick={() => onPick(d.label)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity 0.2s' }}>
              <span className="num" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{d.count}</span>
              <div style={{ width: '100%', maxWidth: 56, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div className="bar-fill" style={{ width: '100%', height: mounted ? `${h}%` : '0%', minHeight: 4, background: color, borderRadius: 'var(--r-xs)', boxShadow: 'var(--sh-1)' }} />
              </div>
              <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Sparkline
// ════════════════════════════════════════════════════════════════════════════
function Sparkline({ data, accent, mounted }: { data: { dateKey: string; count: number }[]; accent: string; mounted: boolean }) {
  if (data.length < 2) return <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>데이터 부족</div>
  const max = Math.max(...data.map((d) => d.count))
  const W = 100
  const H = 30
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.count / max) * (H - 3) - 1.5
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const peak = data.reduce((mx, d, i) => (d.count > data[mx].count ? i : mx), 0)

  return (
    <div>
      <svg width="100%" height={92} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.24" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sparkGrad)" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 1s ease 0.3s' }} />
        <polyline className="sparkline-path" points={line} fill="none" stroke={accent} strokeWidth={1.3} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={mounted ? 0 : 1} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[peak][0]} cy={pts[peak][1]} r={2.1} fill={accent} vectorEffect="non-scaling-stroke" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 0.4s ease 1.1s' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
        <span className="num">{data[0].dateKey}</span>
        <span style={{ color: accent, fontWeight: 600 }}>최다 {data[peak].dateKey} · {data[peak].count}건</span>
        <span className="num">{data[data.length - 1].dateKey}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Heatmap
// ════════════════════════════════════════════════════════════════════════════
function Heatmap({ matrix, accent }: { matrix: number[][]; accent: string }) {
  const max = matrixMax(matrix)
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 4, minWidth: 560 }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="num" style={{ fontSize: 9.5, color: 'var(--ink-3)', textAlign: 'center' }}>{h % 6 === 0 ? h : ''}</div>
        ))}
        {matrix.map((row, wd) => (
          <HeatRow key={wd} wd={wd} row={row} max={max} accent={accent} />
        ))}
      </div>
    </div>
  )
}

function HeatRow({ wd, row, max, accent }: { wd: number; row: number[]; max: number; accent: string }) {
  return (
    <>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', paddingRight: 6, fontWeight: 500 }}>{WEEKDAYS[wd]}</div>
      {row.map((v, h) => (
        <div
          key={h}
          className="heat-cell"
          title={`${WEEKDAYS[wd]}요일 ${h}시 · ${v}건`}
          style={{
            aspectRatio: '1',
            borderRadius: 5,
            background: v === 0 ? 'var(--oat)' : `color-mix(in srgb, ${accent} ${Math.round((v / max) * 78 + 18)}%, var(--paper))`,
          }}
        />
      ))}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Ranking bars
// ════════════════════════════════════════════════════════════════════════════
function RankBars({
  data, accent, total, unit, mounted, onPick, activeValue, glyph,
}: {
  data: CatCount[]; accent: string; total: number; unit: string; mounted: boolean
  onPick?: (value: string) => void; activeValue?: string; glyph?: boolean
}) {
  const top = data.slice(0, 10)
  const max = top.length ? top[0].count : 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top.map((d, i) => {
        const dim = activeValue !== undefined && activeValue !== d.label
        const gl = glyph ? emojiFor(d.label) : ''
        return (
          <div key={d.label} onClick={onPick ? () => onPick(d.label) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: dim ? 0.32 : 1, transition: 'opacity 0.2s', cursor: onPick ? 'pointer' : 'default' }}>
            <span className="num" style={{ fontSize: 12.5, color: 'var(--ink-3)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, height: 38, borderRadius: 999, position: 'relative', background: 'var(--oat)', overflow: 'hidden' }}>
              <div className="bar-fill" style={{ position: 'absolute', inset: '0 auto 0 0', width: mounted ? `${(d.count / max) * 100}%` : '0%', background: `color-mix(in srgb, ${accent} 24%, var(--paper))`, transitionDelay: `${i * 45}ms` }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 16px' }}>
                <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)', fontWeight: 500 }} title={d.label}>
                  {gl && <span style={{ marginRight: 6, color: 'var(--ink-3)', fontSize: 11 }}>{gl}</span>}
                  {d.label}
                </span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600, color: accent, flexShrink: 0 }}>{d.count}{unit} · {total ? Math.round((d.count / total) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Review card
// ════════════════════════════════════════════════════════════════════════════
function ReviewCard({
  row, emailCol, longCol, urlCol, catCols, numCols, flagCols, delay,
}: {
  row: SheetRow; emailCol?: string; longCol?: string; urlCol?: string
  catCols: string[]; numCols: string[]; flagCols: string[]; delay: number
}) {
  const [open, setOpen] = useState(false)
  const draft = longCol ? row[longCol] : ''
  const long = draft.length > 150

  return (
    <div className="card lift anim" style={{ ['--c' as string]: 'var(--terracotta)', animationDelay: `${delay}ms`, padding: '20px', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emailCol ? extractName(row[emailCol]) : '—'}</span>
        {emailCol && <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{extractEmail(row[emailCol])}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {catCols.slice(0, 4).map((c, i) => (row[c] ? <Pill key={c} label={row[c]} accent={accentFor(i)} glyph /> : null))}
        {numCols.map((c) => (row[c] ? <Pill key={c} label={`${c.replace(/\(.*\)/, '')} ${row[c]}`} accent="var(--clay)" /> : null))}
        {flagCols.map((c) => (row[c] ? <Pill key={c} label={row[c]} accent="var(--terracotta)" glyph /> : null))}
      </div>
      {draft && (
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: open ? 800 : 66, overflow: 'hidden', background: 'var(--oat)', borderRadius: 'var(--r-sm)', padding: '14px 16px', transition: 'max-height 0.4s ease' }}>{draft}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {long && (
          <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 12.5, color: 'var(--olive)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{open ? '접기 ▲' : '초안 전체 보기 ▼'}</button>
        )}
        {urlCol && row[urlCol]?.startsWith('http') && (
          <a href={row[urlCol]} target="_blank" rel="noopener noreferrer" className="linkpill" style={{ fontSize: 12.5, color: 'var(--mustard-deep)', padding: '6px 14px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--mustard) 28%, var(--line))', background: 'color-mix(in srgb, var(--mustard) 10%, var(--paper))', marginLeft: 'auto', fontWeight: 600 }}>✉ Gmail 열기</a>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Table
// ════════════════════════════════════════════════════════════════════════════
function cellRender(col: string, val: string, type: ColumnType, guest: boolean) {
  if (!val) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>
  if (type === 'url' && val.startsWith('http')) {
    if (guest) return <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>🔒</span>
    return (
      <a href={val} target="_blank" rel="noopener noreferrer" title={val} className="linkpill" style={{ color: 'var(--mustard-deep)', fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--mustard) 10%, var(--paper))', border: '1px solid color-mix(in srgb, var(--mustard) 24%, var(--line))', fontWeight: 600 }}>✉ 열기</a>
    )
  }
  if (type === 'flag') return <Pill label={val} accent="var(--terracotta)" glyph />
  if (type === 'email') return <Pill label={guest ? maskEmailDisplay(val) : extractName(val)} accent="var(--dusty)" title={guest ? '게스트 모드 — 마스킹됨' : extractEmail(val)} />
  if (type === 'category') return <Pill label={val} accent="var(--olive)" glyph />
  if (type === 'longtext') {
    if (guest) return <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>🔒 로그인 후 확인</span>
    return <span title={val} style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.5, display: 'inline-block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{val}</span>
  }
  if (type === 'numeric' || type === 'id' || type === 'datetime') return <span className="num" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{val}</span>
  return <span style={{ fontSize: 13.5 }}>{val}</span>
}

function DataTable({ headers, rows, schema, guest, search }: { headers: string[]; rows: SheetRow[]; schema: Record<string, ColumnType>; guest: boolean; search: string }) {
  const cols = headers.filter((h) => schema[h] && schema[h] !== 'empty')
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => Object.values(r).some((v) => v?.toLowerCase().includes(q)))
  }, [rows, search])

  return (
    <div>
      {search.trim() && (
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
          상단 검색 &ldquo;<Strong color="var(--mustard-deep)">{search}</Strong>&rdquo; 결과
        </div>
      )}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--oat)' }}>
              {cols.map((h) => (
                <th key={h} className="microlabel" style={{ padding: '14px 15px', textAlign: 'left', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', fontSize: 11.5, position: 'sticky', top: 0, background: 'var(--oat)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="row-hover" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                {cols.map((c) => (
                  <td key={c} style={{ padding: '13px 15px', maxWidth: 340, whiteSpace: 'nowrap' }}>{cellRender(c, r[c], schema[c], guest)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 14 }}>검색 결과가 없습니다</div>}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 11 }} className="num">{filtered.length}/{rows.length}건 표시</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ headers, rows, schema, fetchedAt, guest = false, account, onSignOut }: Props) {
  const router = useRouter()
  const mounted = useMounted()
  const [isPending, startTransition] = useTransition()
  const [allOpen, setAllOpen] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({ time: false, dist: false, sender: false, review: false, table: false })
  const [filter, setFilter] = useState<Filter | null>(null)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const sectionRefs = {
    time: useRef<HTMLDivElement>(null),
    dist: useRef<HTMLDivElement>(null),
    sender: useRef<HTMLDivElement>(null),
    review: useRef<HTMLDivElement>(null),
    table: useRef<HTMLDivElement>(null),
  }

  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }))
  const toggleAll = () => {
    const n = !allOpen
    setAllOpen(n)
    setOpen({ time: n, dist: n, sender: n, review: n, table: n })
  }
  const refresh = () => {
    startTransition(() => router.refresh())
    setToast('최신 데이터로 갱신했어요')
    setTimeout(() => setToast(''), 2200)
  }
  const onSearch = (v: string) => {
    setSearch(v)
    if (v.trim()) setOpen((p) => ({ ...p, table: true }))
  }

  const g = useMemo(() => groupColumnsByType(schema), [schema])
  const dtCol = g.datetime[0]
  const slaCol = g.datetime[1]
  const emailCol = g.email[0]
  const longCol = g.longtext[0]
  const urlCol = g.url[0]
  const flagCols = g.flag
  const catCols = g.category
  const numCols = g.numeric

  const view = useMemo(() => (filter ? rows.filter(filter.test) : rows), [rows, filter])

  const pickCat = (col: string, value: string) => {
    const key = `${col}:${value}`
    setFilter((f) => (f?.key === key ? null : { key, label: `${col} = ${value}`, test: (r) => (r[col] ?? '').trim() === value }))
  }
  const pickDomain = (value: string) => {
    const key = `dom:${value}`
    setFilter((f) => (f?.key === key ? null : { key, label: `도메인 = ${value}`, test: (r) => extractDomain(emailCol ? r[emailCol] : '') === value }))
  }
  const pickSender = (value: string) => {
    const key = `snd:${value}`
    setFilter((f) => (f?.key === key ? null : { key, label: `발신자 = ${value}`, test: (r) => extractEmail(emailCol ? r[emailCol] : '') === value }))
  }
  const pickFlag = (col: string) => {
    const key = `flag:${col}`
    setFilter((f) => (f?.key === key ? null : { key, label: col, test: (r) => !!(r[col] ?? '').trim() }))
  }

  const total = rows.length
  const vTotal = view.length
  const count = (col: string, data = view) => data.filter((r) => (r[col] ?? '').trim()).length
  const pct = (n: number, base = vTotal) => (base ? Math.round((n / base) * 100) : 0)

  const replyCol = catCols.find((c) => categoryCounts(rows, c).some((x) => x.label.includes('미회신')))
  const statusCol = catCols.find((c) => categoryCounts(rows, c).some((x) => x.label.includes('조치필요')))
  const miLabel = replyCol ? categoryCounts(rows, replyCol).find((x) => x.label.includes('미회신'))?.label : undefined

  const kpiAccents = ['var(--dusty)', 'var(--terracotta)', 'var(--mustard)', 'var(--olive)']
  const kpiEn = ['total', 'delayed', 'review', 'pending']
  const kpis: { en: string; label: string; value: number; unit?: string; accent: string; onClick?: () => void; active?: boolean }[] = [
    { en: 'total', label: '총 티켓', value: vTotal, unit: filter ? `건 · 전체 ${total}건 중` : '건', accent: kpiAccents[0] },
  ]
  flagCols.forEach((fc) => kpis.push({ en: 'flag', label: fc, value: count(fc), unit: `건 · ${pct(count(fc))}%`, accent: 'var(--terracotta)', onClick: () => pickFlag(fc), active: filter?.key === `flag:${fc}` }))
  if (replyCol && miLabel) {
    const v = view.filter((r) => (r[replyCol] ?? '').trim() === miLabel).length
    kpis.push({ en: 'pending', label: '미회신', value: v, unit: `건 · ${pct(v)}%`, accent: 'var(--olive)', onClick: () => pickCat(replyCol, miLabel), active: filter?.key === `${replyCol}:${miLabel}` })
  }
  const kpi4 = kpis.slice(0, 4).map((k, i) => ({ ...k, accent: kpiAccents[i] ?? k.accent, en: kpiEn[i] ?? k.en }))

  const reviewFlag = flagCols.find((c) => c.includes('검토')) ?? flagCols[0]
  const impCol = numCols.find((c) => c.includes('중요')) ?? numCols[0]
  const elapsedCol = numCols.find((c) => c.includes('경과'))
  const reviewRows = useMemo(() => {
    if (!reviewFlag) return []
    return view
      .filter((r) => (r[reviewFlag] ?? '').trim())
      .sort((a, b) => {
        const ia = impCol ? Number(a[impCol]) || 0 : 0
        const ib = impCol ? Number(b[impCol]) || 0 : 0
        if (ib !== ia) return ib - ia
        const ea = elapsedCol ? Number(a[elapsedCol]) || 0 : 0
        const eb = elapsedCol ? Number(b[elapsedCol]) || 0 : 0
        return eb - ea
      })
  }, [view, reviewFlag, impCol, elapsedCol])

  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const spark = useMemo(() => (dtCol ? dailyVolume(view, dtCol) : []), [view, dtCol])
  const heat = useMemo(() => (dtCol ? heatmapMatrix(view, dtCol) : []), [view, dtCol])
  const numDist = numCols.filter((c) => new Set(rows.map((r) => r[c]).filter(Boolean)).size <= 15)
  const activeCatValue = (col: string) => (filter?.key.startsWith(`${col}:`) ? filter.key.slice(col.length + 1) : undefined)

  // ── bento ordering for distribution ───────────────────────────────────
  const distinctOf = (c: string) => categoryCounts(rows, c).length
  const sentimentCol = catCols.find((c) => categoryCounts(rows, c).some((x) => x.label.includes('긍정') || x.label.includes('부정')))
  const donutCats = catCols.filter((c) => c !== sentimentCol).sort((a, b) => distinctOf(b) - distinctOf(a))
  const spanFor = (c: string) => { const d = distinctOf(c); return d >= 7 ? 4 : d >= 5 ? 3 : 2 }
  // interleave: [biggest, mood, ...rest]
  const bento: { kind: 'donut' | 'mood'; col: string }[] = []
  if (donutCats[0]) bento.push({ kind: 'donut', col: donutCats[0] })
  if (sentimentCol) bento.push({ kind: 'mood', col: sentimentCol })
  donutCats.slice(1).forEach((c) => bento.push({ kind: 'donut', col: c }))

  const diag: React.ReactNode[] = [<>전체 <Strong color={C_INK}>{total}건</Strong></>]
  if (replyCol && miLabel) {
    const mi = view.filter((r) => (r[replyCol] ?? '').trim() === miLabel).length
    diag.push(<> · 미회신 <Strong color="var(--olive)">{mi}건</Strong> ({pct(mi)}%)</>)
  }
  flagCols.forEach((fc) => diag.push(<> · {fc} <Strong color="var(--terracotta)">{count(fc)}건</Strong></>))
  if (statusCol) {
    const ac = view.filter((r) => (r[statusCol] ?? '').trim() === '조치필요').length
    if (ac) diag.push(<> · 조치필요 <Strong color="var(--mustard-deep)">{ac}건</Strong></>)
  }

  const avatarInitial = guest ? 'G' : (account?.trim()?.[0]?.toUpperCase() ?? '·')

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 110 }}>
      {toast && (
        <div className="toast" style={{ position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '12px 22px', borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--sh-3)' }}>✦ {toast}</div>
      )}

      {/* Header — Logo | Search | Avatar */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '15px 30px', borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--cream) 84%, transparent)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <LogoMark />
          <Wordmark />
        </div>

        {/* global search */}
        <div className="search" style={{ flex: 1, maxWidth: 460, marginInline: 'auto' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
            <circle cx="11" cy="11" r="7" stroke="var(--ink-2)" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="발신자 · 분류 · 부서 · 내용 검색" aria-label="검색" />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>}
        </div>

        {/* my-page avatar + menu */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button className="avatar" onClick={() => setMenuOpen((o) => !o)} aria-label="마이페이지" style={{ background: guest ? 'var(--oat)' : 'color-mix(in srgb, var(--olive) 14%, var(--paper))' }}>
            {avatarInitial}
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
              <div className="menu">
                <div style={{ padding: '8px 12px 10px' }}>
                  <div className="microlabel" style={{ marginBottom: 4 }}>{guest ? '게스트 모드' : '내 계정'}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guest ? '둘러보는 중' : (account ?? '로그인됨')}</div>
                </div>
                <hr className="hairline" style={{ margin: '4px 0' }} />
                <div style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                  <div>데이터 · dummy mail data <span style={{ color: 'var(--ink-3)' }}>(사본)</span></div>
                  <div className="num" style={{ color: 'var(--ink-3)' }}>업데이트 {fmt(fetchedAt)}</div>
                </div>
                <hr className="hairline" style={{ margin: '4px 0' }} />
                {onSignOut && (
                  <button className="menu-item" onClick={() => { setMenuOpen(false); onSignOut() }} style={{ color: 'var(--terracotta)', fontWeight: 600 }}>
                    {guest ? '← 나가기' : '로그아웃'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 28px 0' }}>
        {guest && (
          <div className="anim" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px', borderRadius: 999, marginBottom: 20, background: 'color-mix(in srgb, var(--mustard) 9%, var(--paper))', border: '1px solid color-mix(in srgb, var(--mustard) 24%, var(--line))', fontSize: 13.5, color: 'var(--ink-2)' }}>
            <span>🔒</span> 게스트 모드 — 집계 지표만 표시되며 개별 메일·이메일·AI 초안 등 민감 정보는 가려져 있습니다.
          </div>
        )}

        {filter && (
          <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderRadius: 999, marginBottom: 20, background: 'var(--paper)', border: '1px solid color-mix(in srgb, var(--dusty) 30%, var(--line))', boxShadow: 'var(--sh-1)' }}>
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>필터 — <Strong color="var(--dusty)">{filter.label}</Strong> · {vTotal}건 ({pct(vTotal, total)}%)</span>
            <button onClick={() => setFilter(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '6px 15px', fontSize: 12.5, cursor: 'pointer' }}>✕ 해제</button>
          </div>
        )}

        {/* Hero */}
        <div className="card anim" style={{ animationDelay: '40ms', padding: '30px 34px', borderRadius: 'var(--r-lg)', marginBottom: 18, boxShadow: 'var(--sh-2)' }}>
          <Eyebrow en="overview" ko="진단 요약" accent="var(--mustard)" big />
          <p style={{ fontSize: 19, color: 'var(--ink)', lineHeight: 1.9, marginTop: 14, letterSpacing: '-0.01em', fontWeight: 400 }}>{diag.map((p, i) => <span key={i}>{p}</span>)}</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 12 }}>
          {kpi4.map((k, i) => (
            <KPICard key={k.label} {...k} delay={80 + i * 70} />
          ))}
        </div>

        {/* expand-all toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px 6px' }}>
          <span className="microlabel">상세 분석 · DETAILS</span>
          <button className="toggle-link" onClick={toggleAll}>{allOpen ? '모두 접기 −' : '모두 펼치기 +'}</button>
        </div>

        {dtCol && (
          <Section id="sec-time" innerRef={sectionRefs.time} en="trend" title="수신 추이 & 시간대" accent="var(--dusty)" isOpen={open.time} onToggle={() => toggle('time')} meta={`${dtCol}${slaCol ? ` · ${slaCol}` : ''}`} delay={120}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 26 }}>
              <div>
                <div className="microlabel" style={{ marginBottom: 14 }}>일자별 수신량</div>
                <Sparkline data={spark} accent="var(--dusty)" mounted={mounted} />
              </div>
              <hr className="hairline" />
              <div>
                <div className="microlabel" style={{ marginBottom: 14 }}>요일 × 시간 히트맵</div>
                <Heatmap matrix={heat} accent="var(--olive)" />
              </div>
            </div>
          </Section>
        )}

        {(catCols.length > 0 || numDist.length > 0) && (
          <Section id="sec-dist" innerRef={sectionRefs.dist} en="distribution" title="분류 · 상태 분포" accent="var(--olive)" isOpen={open.dist} onToggle={() => toggle('dist')} meta={`${catCols.length}개 범주 · 클릭해 필터`} delay={150}>
            {/* bento grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, gridAutoFlow: 'dense' }}>
              {bento.map((t, i) =>
                t.kind === 'mood' ? (
                  <div key={t.col} style={{ gridColumn: 'span 2', minWidth: 0 }}>
                    <MoodTile col={t.col} data={categoryCounts(view, t.col)} total={vTotal} onPick={(v) => pickCat(t.col, v)} activeValue={activeCatValue(t.col)} />
                  </div>
                ) : (
                  <div key={t.col} style={{ gridColumn: `span ${spanFor(t.col)}`, minWidth: 0 }}>
                    <Donut col={t.col} data={categoryCounts(view, t.col)} accent={accentFor(i)} mounted={mounted} onPick={(v) => pickCat(t.col, v)} activeValue={activeCatValue(t.col)} big={spanFor(t.col) >= 4} />
                  </div>
                )
              )}
            </div>
            {/* importance strip — full width, distinct */}
            {numDist.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {numDist.map((c) => {
                  const cc = categoryCounts(view, c).sort((a, b) => Number(a.label) - Number(b.label))
                  return <ImportanceStrip key={c} col={c} data={cc} mounted={mounted} onPick={(v) => pickCat(c, v)} activeValue={activeCatValue(c)} />
                })}
              </div>
            )}
          </Section>
        )}

        {emailCol && (
          <Section id="sec-sender" innerRef={sectionRefs.sender} en="senders" title="발신자 분석" accent="var(--terracotta)" isOpen={open.sender} onToggle={() => toggle('sender')} meta={`${emailCol} · 클릭해 필터`} delay={180}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 30 }}>
              <div>
                <div className="microlabel" style={{ marginBottom: 14 }}>Top 도메인</div>
                <RankBars data={domainRanking(view, emailCol)} accent="var(--terracotta)" total={vTotal} unit="건" mounted={mounted} onPick={pickDomain} activeValue={filter?.key.startsWith('dom:') ? filter.key.slice(4) : undefined} />
              </div>
              <div>
                <div className="microlabel" style={{ marginBottom: 14 }}>Top 발신자{guest ? ' (마스킹)' : ''}</div>
                {guest ? (
                  <div style={{ color: 'var(--ink-3)', fontSize: 13.5, padding: '14px 0' }}>🔒 발신자 개별 정보는 로그인 후 확인할 수 있어요.</div>
                ) : (
                  <RankBars data={senderRanking(view, emailCol)} accent="var(--dusty)" total={vTotal} unit="건" mounted={mounted} onPick={pickSender} activeValue={filter?.key.startsWith('snd:') ? filter.key.slice(4) : undefined} />
                )}
              </div>
            </div>
          </Section>
        )}

        {longCol && reviewFlag && !guest && (
          <Section id="sec-review" innerRef={sectionRefs.review} en="review" title="검토 뷰 — AI 회신초안" accent="var(--terracotta)" isOpen={open.review} onToggle={() => toggle('review')} meta={`${reviewRows.length}건 · ${reviewFlag}`} delay={210}>
            {reviewRows.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 14, padding: '12px 0' }}>검토 대상이 없습니다.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
                {reviewRows.slice(0, 60).map((r, i) => (
                  <ReviewCard key={i} row={r} emailCol={emailCol} longCol={longCol} urlCol={urlCol} catCols={catCols} numCols={numCols} flagCols={flagCols} delay={Math.min(i * 25, 400)} />
                ))}
              </div>
            )}
            {reviewRows.length > 60 && <div className="num" style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 12 }}>중요도순 상위 60건 · 전체 {reviewRows.length}건</div>}
          </Section>
        )}

        <Section id="sec-table" innerRef={sectionRefs.table} en="records" title="전체 데이터 테이블" accent="var(--mustard)" isOpen={open.table} onToggle={() => toggle('table')} meta={`${vTotal}건 · ${headers.length}열`} delay={240}>
          <DataTable headers={headers} rows={view} schema={schema} guest={guest} search={search} />
        </Section>

        <div className="eyebrow" style={{ textAlign: 'center', marginTop: 30, color: 'var(--ink-3)', fontSize: 13 }}>
          STEP 0 자동 스키마 추론 · STEP 2 타입별 시각화 자동 매핑 · 읽기 전용
        </div>
      </main>

      {/* refresh FAB (fixed bottom-right) */}
      <div className="fab-wrap">
        <span className="fab-label">{isPending ? '갱신 중…' : '데이터 새로고침'}</span>
        <button className="fab" onClick={refresh} disabled={isPending} aria-label="리프레시">
          <span className={isPending ? 'spin' : undefined} style={{ display: 'inline-block' }}>↻</span>
        </button>
      </div>
    </div>
  )
}

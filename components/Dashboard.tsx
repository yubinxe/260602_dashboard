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

function useCountUp(target: number, dur = 900): number {
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
    const guard = setTimeout(() => setV(target), dur + 380)
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
  label,
  accent,
  title,
  onClick,
  active,
  glyph,
}: {
  label: string
  accent: string
  title?: string
  onClick?: () => void
  active?: boolean
  glyph?: boolean
}) {
  const g = glyph ? emojiFor(label) : ''
  return (
    <span
      title={title ?? label}
      onClick={onClick}
      className={`chip${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
      style={{
        ['--c' as string]: accent,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: `color-mix(in srgb, ${accent} 11%, var(--paper))`,
        color: accent,
        border: `1px solid color-mix(in srgb, ${accent} 26%, var(--line))`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      <span className="dot" style={{ width: 5, height: 5, background: accent, flexShrink: 0 }} />
      {g && <span style={{ fontSize: 10, opacity: 0.85 }}>{g}</span>}
      {label}
    </span>
  )
}

function Eyebrow({ en, ko, accent }: { en: string; ko: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span className="dot" style={{ width: 7, height: 7, background: accent, transform: 'translateY(-1px)' }} />
      <span className="eyebrow" style={{ color: accent }}>{en}</span>
      <span className="microlabel">{ko}</span>
    </div>
  )
}

function Strong({ children, color }: { children: React.ReactNode; color: string }) {
  return <strong style={{ color, fontWeight: 600 }}>{children}</strong>
}

function Btn({
  onClick,
  disabled,
  children,
  variant = 'ghost',
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'solid' | 'ghost' | 'accent'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
      style={{ padding: '8px 16px', fontSize: 12.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  )
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
        padding: '22px 22px 20px',
        borderRadius: 'var(--r-lg)',
        borderColor: active ? `color-mix(in srgb, ${accent} 45%, var(--line))` : undefined,
        boxShadow: active ? 'var(--sh-2)' : undefined,
      }}
    >
      <Eyebrow en={en} ko={label} accent={accent} />
      <div className="kpi-num" style={{ fontSize: 46, fontWeight: 500, color: accent, lineHeight: 1, marginTop: 16 }}>
        {animated.toLocaleString()}
      </div>
      {unit && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 7 }}>{unit}</div>}
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
      style={{ animationDelay: `${delay}ms`, marginBottom: 14, borderRadius: 'var(--r-lg)', overflow: 'hidden', scrollMarginTop: 84 }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="eyebrow" style={{ color: accent }}>{en}</span>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
          {meta && <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11.5 }}>{meta}</span>}
        </span>
        <span className={`caret${isOpen ? ' open' : ''}`} style={{ fontSize: 10, color: 'var(--ink-3)' }}>▶</span>
      </button>
      {isOpen && (
        <>
          <hr className="hairline" style={{ margin: '0 22px' }} />
          <div className="section-body" style={{ padding: '18px 22px 22px' }}>{children}</div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Donut
// ════════════════════════════════════════════════════════════════════════════
function Donut({
  col, data, accent, onPick, activeValue, mounted,
}: {
  col: string; data: CatCount[]; accent: string; onPick: (value: string) => void; activeValue?: string; mounted: boolean
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const top = data.slice(0, 8)
  const r = 52
  const C = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="card" style={{ ['--c' as string]: accent, padding: '18px', borderRadius: 'var(--r)' }}>
      <Eyebrow en="category" ko={col} accent={accent} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14 }}>
        <svg width={118} height={118} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--oat)" strokeWidth={16} />
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
                strokeWidth={activeValue === d.label ? 22 : 16}
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
          <text x={70} y={67} textAnchor="middle" fontSize={29} fontWeight={500} fill="var(--ink)" fontFamily="var(--serif)">{total}</text>
          <text x={70} y={87} textAnchor="middle" fontSize={10} fill="var(--ink-3)" letterSpacing="0.1em">건</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          {top.map((d, i) => {
            const dim = activeValue !== undefined && activeValue !== d.label
            const g = emojiFor(d.label)
            return (
              <div key={d.label} className={`legend-row${dim ? ' dim' : ''}`} onClick={() => onPick(d.label)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="dot" style={{ width: 9, height: 9, background: accentFor(i), flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>
                  {g && <span style={{ marginRight: 4, color: 'var(--ink-3)', fontSize: 10 }}>{g}</span>}
                  {d.label}
                </span>
                <span className="num" style={{ color: 'var(--ink)', fontSize: 13 }}>{d.count}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: 10.5, width: 34, textAlign: 'right' }}>{total ? Math.round((d.count / total) * 100) : 0}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Sparkline
// ════════════════════════════════════════════════════════════════════════════
function Sparkline({ data, accent, mounted }: { data: { dateKey: string; count: number }[]; accent: string; mounted: boolean }) {
  if (data.length < 2) return <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>데이터 부족</div>
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
      <svg width="100%" height={78} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sparkGrad)" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 1s ease 0.3s' }} />
        <polyline className="sparkline-path" points={line} fill="none" stroke={accent} strokeWidth={1.1} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={mounted ? 0 : 1} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[peak][0]} cy={pts[peak][1]} r={1.9} fill={accent} vectorEffect="non-scaling-stroke" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 0.4s ease 1.1s' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6 }}>
        <span className="num">{data[0].dateKey}</span>
        <span style={{ color: accent, fontWeight: 600 }}>최다 {data[peak].dateKey} · {data[peak].count}건</span>
        <span className="num">{data[data.length - 1].dateKey}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Heatmap (warm neutral palette)
// ════════════════════════════════════════════════════════════════════════════
function Heatmap({ matrix, accent }: { matrix: number[][]; accent: string }) {
  const max = matrixMax(matrix)
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 3, minWidth: 540 }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="num" style={{ fontSize: 8.5, color: 'var(--ink-3)', textAlign: 'center' }}>{h % 6 === 0 ? h : ''}</div>
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
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', paddingRight: 4 }}>{WEEKDAYS[wd]}</div>
      {row.map((v, h) => (
        <div
          key={h}
          className="heat-cell"
          title={`${WEEKDAYS[wd]}요일 ${h}시 · ${v}건`}
          style={{
            aspectRatio: '1',
            borderRadius: 4,
            background: v === 0 ? 'var(--oat)' : `color-mix(in srgb, ${accent} ${Math.round((v / max) * 78 + 16)}%, var(--paper))`,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {top.map((d, i) => {
        const dim = activeValue !== undefined && activeValue !== d.label
        const g = glyph ? emojiFor(d.label) : ''
        return (
          <div key={d.label} onClick={onPick ? () => onPick(d.label) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: dim ? 0.32 : 1, transition: 'opacity 0.2s', cursor: onPick ? 'pointer' : 'default' }}>
            <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, height: 32, borderRadius: 999, position: 'relative', background: 'var(--oat)', overflow: 'hidden' }}>
              <div className="bar-fill" style={{ position: 'absolute', inset: '0 auto 0 0', width: mounted ? `${(d.count / max) * 100}%` : '0%', background: `color-mix(in srgb, ${accent} 22%, var(--paper))`, transitionDelay: `${i * 45}ms` }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 14px' }}>
                <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }} title={d.label}>
                  {g && <span style={{ marginRight: 5, color: 'var(--ink-3)', fontSize: 10 }}>{g}</span>}
                  {d.label}
                </span>
                <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: accent, flexShrink: 0 }}>{d.count}{unit} · {total ? Math.round((d.count / total) * 100) : 0}%</span>
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
    <div className="card lift anim" style={{ ['--c' as string]: 'var(--terracotta)', animationDelay: `${delay}ms`, padding: '18px', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emailCol ? extractName(row[emailCol]) : '—'}</span>
        {emailCol && <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{extractEmail(row[emailCol])}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {catCols.slice(0, 4).map((c, i) => (row[c] ? <Pill key={c} label={row[c]} accent={accentFor(i)} glyph /> : null))}
        {numCols.map((c) => (row[c] ? <Pill key={c} label={`${c.replace(/\(.*\)/, '')} ${row[c]}`} accent="var(--clay)" /> : null))}
        {flagCols.map((c) => (row[c] ? <Pill key={c} label={row[c]} accent="var(--terracotta)" glyph /> : null))}
      </div>
      {draft && (
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxHeight: open ? 800 : 62, overflow: 'hidden', background: 'var(--oat)', borderRadius: 'var(--r-sm)', padding: '12px 14px', transition: 'max-height 0.4s ease' }}>{draft}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {long && (
          <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, color: 'var(--olive)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{open ? '접기 ▲' : '초안 전체 보기 ▼'}</button>
        )}
        {urlCol && row[urlCol]?.startsWith('http') && (
          <a href={row[urlCol]} target="_blank" rel="noopener noreferrer" className="linkpill" style={{ fontSize: 11.5, color: 'var(--mustard-deep)', padding: '5px 13px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--mustard) 28%, var(--line))', background: 'color-mix(in srgb, var(--mustard) 10%, var(--paper))', marginLeft: 'auto', fontWeight: 600 }}>✉ Gmail 열기</a>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Table
// ════════════════════════════════════════════════════════════════════════════
function cellRender(col: string, val: string, type: ColumnType, guest: boolean) {
  if (!val) return <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>—</span>
  if (type === 'url' && val.startsWith('http')) {
    if (guest) return <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>🔒</span>
    return (
      <a href={val} target="_blank" rel="noopener noreferrer" title={val} className="linkpill" style={{ color: 'var(--mustard-deep)', fontSize: 11, padding: '2px 9px', borderRadius: 999, background: 'color-mix(in srgb, var(--mustard) 10%, var(--paper))', border: '1px solid color-mix(in srgb, var(--mustard) 24%, var(--line))' }}>✉ 열기</a>
    )
  }
  if (type === 'flag') return <Pill label={val} accent="var(--terracotta)" glyph />
  if (type === 'email') return <Pill label={guest ? maskEmailDisplay(val) : extractName(val)} accent="var(--dusty)" title={guest ? '게스트 모드 — 마스킹됨' : extractEmail(val)} />
  if (type === 'category') return <Pill label={val} accent="var(--olive)" glyph />
  if (type === 'longtext') {
    if (guest) return <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>🔒 로그인 후 확인</span>
    return <span title={val} style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{val.length > 46 ? val.slice(0, 46) + '…' : val}</span>
  }
  if (type === 'numeric' || type === 'id' || type === 'datetime') return <span className="num" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{val}</span>
  return <span style={{ fontSize: 12.5 }}>{val}</span>
}

function DataTable({ headers, rows, schema, guest }: { headers: string[]; rows: SheetRow[]; schema: Record<string, ColumnType>; guest: boolean }) {
  const [search, setSearch] = useState('')
  const cols = headers.filter((h) => schema[h] && schema[h] !== 'empty')
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => Object.values(r).some((v) => v?.toLowerCase().includes(q)))
  }, [rows, search])

  return (
    <div>
      <input
        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="발신자 · 분류 · 부서 · 내용 검색"
        style={{ width: '100%', padding: '11px 16px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, outline: 'none', marginBottom: 14, boxShadow: 'var(--sh-1)' }}
      />
      <div style={{ overflowX: 'auto', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--oat)' }}>
              {cols.map((h) => (
                <th key={h} className="microlabel" style={{ padding: '11px 13px', textAlign: 'left', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="row-hover" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                {cols.map((c) => (
                  <td key={c} style={{ padding: '9px 13px', maxWidth: 260, whiteSpace: 'nowrap' }}>{cellRender(c, r[c], schema[c], guest)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 34, color: 'var(--ink-3)', fontSize: 13 }}>검색 결과가 없습니다</div>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 9 }} className="num">{filtered.length}/{rows.length}건 표시</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ headers, rows, schema, fetchedAt, guest = false, onSignOut }: Props) {
  const router = useRouter()
  const mounted = useMounted()
  const [isPending, startTransition] = useTransition()
  const [allOpen, setAllOpen] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({ time: false, dist: false, sender: false, review: false, table: false })
  const [filter, setFilter] = useState<Filter | null>(null)
  const [toast, setToast] = useState('')

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
  const openAndScroll = (k: keyof typeof sectionRefs) => {
    setOpen((p) => ({ ...p, [k]: true }))
    setTimeout(() => sectionRefs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 90)
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

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 96 }}>
      {toast && (
        <div className="toast" style={{ position: 'fixed', top: 78, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '11px 20px', borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--sh-3)' }}>✦ {toast}</div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 36px', borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--cream) 82%, transparent)', backdropFilter: 'blur(18px) saturate(1.4)', WebkitBackdropFilter: 'blur(18px) saturate(1.4)', position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
          <LogoMark />
          <Wordmark />
          <span className="chip" style={{ ['--c' as string]: 'var(--olive)', padding: '3px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'color-mix(in srgb, var(--olive) 10%, var(--paper))', color: 'var(--olive)', border: '1px solid color-mix(in srgb, var(--olive) 24%, var(--line))' }}>
            {guest ? '게스트 보기' : 'dummy mail data · 사본'}
          </span>
          <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>업데이트 {fmt(fetchedAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {onSignOut && <Btn onClick={onSignOut} variant="ghost">{guest ? '← 나가기' : '로그아웃'}</Btn>}
          <Btn onClick={toggleAll} variant="ghost">{allOpen ? '모두 접기' : '모두 펼치기'}</Btn>
          <Btn onClick={refresh} disabled={isPending} variant="solid">
            <span className={isPending ? 'spin' : undefined} style={{ display: 'inline-block', marginRight: 5 }}>↻</span>{isPending ? '갱신 중' : '리프레시'}
          </Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 28px 0' }}>
        {guest && (
          <div className="anim" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 999, marginBottom: 18, background: 'color-mix(in srgb, var(--mustard) 9%, var(--paper))', border: '1px solid color-mix(in srgb, var(--mustard) 24%, var(--line))', fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span>🔒</span> 게스트 모드입니다 — 집계 지표만 표시되며 개별 메일·이메일·AI 초안 등 민감 정보는 가려져 있습니다.
          </div>
        )}

        {filter && (
          <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 999, marginBottom: 18, background: 'var(--paper)', border: '1px solid color-mix(in srgb, var(--dusty) 30%, var(--line))', boxShadow: 'var(--sh-1)' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>필터 적용 — <Strong color="var(--dusty)">{filter.label}</Strong> · {vTotal}건 ({pct(vTotal, total)}%)</span>
            <button onClick={() => setFilter(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>✕ 해제</button>
          </div>
        )}

        {/* Hero */}
        <div className="card anim" style={{ animationDelay: '40ms', padding: '26px 30px', borderRadius: 'var(--r-lg)', marginBottom: 18, boxShadow: 'var(--sh-2)' }}>
          <Eyebrow en="overview" ko="진단 요약" accent="var(--mustard)" />
          <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.95, marginTop: 12, letterSpacing: '-0.01em' }}>{diag.map((p, i) => <span key={i}>{p}</span>)}</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {kpi4.map((k, i) => (
            <KPICard key={k.label} {...k} delay={80 + i * 70} />
          ))}
        </div>

        {dtCol && (
          <Section id="sec-time" innerRef={sectionRefs.time} en="trend" title="수신 추이 & 시간대" accent="var(--dusty)" isOpen={open.time} onToggle={() => toggle('time')} meta={`${dtCol}${slaCol ? ` · ${slaCol}` : ''}`} delay={120}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 22 }}>
              <div>
                <div className="microlabel" style={{ marginBottom: 12 }}>일자별 수신량</div>
                <Sparkline data={spark} accent="var(--dusty)" mounted={mounted} />
              </div>
              <hr className="hairline" />
              <div>
                <div className="microlabel" style={{ marginBottom: 12 }}>요일 × 시간 히트맵</div>
                <Heatmap matrix={heat} accent="var(--olive)" />
              </div>
            </div>
          </Section>
        )}

        {(catCols.length > 0 || numDist.length > 0) && (
          <Section id="sec-dist" innerRef={sectionRefs.dist} en="distribution" title="분류 · 상태 분포" accent="var(--olive)" isOpen={open.dist} onToggle={() => toggle('dist')} meta={`${catCols.length}개 범주 · 클릭해 필터`} delay={150}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {catCols.map((c, i) => (
                <Donut key={c} col={c} data={categoryCounts(view, c)} accent={accentFor(i)} mounted={mounted} onPick={(v) => pickCat(c, v)} activeValue={activeCatValue(c)} />
              ))}
            </div>
            {numDist.length > 0 && (
              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {numDist.map((c) => {
                  const cc = categoryCounts(view, c).sort((a, b) => Number(a.label) - Number(b.label))
                  return (
                    <div key={c} className="card" style={{ ['--c' as string]: 'var(--clay)', padding: '18px', borderRadius: 'var(--r)' }}>
                      <Eyebrow en="numeric" ko={`${c} 분포`} accent="var(--clay)" />
                      <div style={{ marginTop: 14 }}><RankBars data={cc} accent="var(--clay)" total={vTotal} unit="건" mounted={mounted} /></div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        )}

        {emailCol && (
          <Section id="sec-sender" innerRef={sectionRefs.sender} en="senders" title="발신자 분석" accent="var(--terracotta)" isOpen={open.sender} onToggle={() => toggle('sender')} meta={`${emailCol} · 클릭해 필터`} delay={180}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 26 }}>
              <div>
                <div className="microlabel" style={{ marginBottom: 12 }}>Top 도메인</div>
                <RankBars data={domainRanking(view, emailCol)} accent="var(--terracotta)" total={vTotal} unit="건" mounted={mounted} onPick={pickDomain} activeValue={filter?.key.startsWith('dom:') ? filter.key.slice(4) : undefined} />
              </div>
              <div>
                <div className="microlabel" style={{ marginBottom: 12 }}>Top 발신자{guest ? ' (마스킹)' : ''}</div>
                {guest ? (
                  <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '14px 0' }}>🔒 발신자 개별 정보는 로그인 후 확인할 수 있어요.</div>
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
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>검토 대상이 없습니다.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {reviewRows.slice(0, 60).map((r, i) => (
                  <ReviewCard key={i} row={r} emailCol={emailCol} longCol={longCol} urlCol={urlCol} catCols={catCols} numCols={numCols} flagCols={flagCols} delay={Math.min(i * 25, 400)} />
                ))}
              </div>
            )}
            {reviewRows.length > 60 && <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12 }}>중요도순 상위 60건 · 전체 {reviewRows.length}건</div>}
          </Section>
        )}

        <Section id="sec-table" innerRef={sectionRefs.table} en="records" title="전체 데이터 테이블" accent="var(--mustard)" isOpen={open.table} onToggle={() => toggle('table')} meta={`${vTotal}건 · ${headers.length}열`} delay={240}>
          <DataTable headers={headers} rows={view} schema={schema} guest={guest} />
        </Section>

        <div className="eyebrow" style={{ textAlign: 'center', marginTop: 28, color: 'var(--ink-3)' }}>
          STEP 0 자동 스키마 추론 · STEP 2 타입별 시각화 자동 매핑 · 읽기 전용
        </div>
      </main>
    </div>
  )
}

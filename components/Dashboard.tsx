'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import type { ColumnType } from '../lib/schema-infer'
import { groupColumnsByType } from '../lib/schema-infer'
import type { SheetRow } from '../lib/sheets'
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
}

interface Filter {
  key: string
  label: string
  test: (r: SheetRow) => boolean
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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

function useCountUp(target: number, dur = 850): number {
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
    // Hard guarantee: regardless of rAF throttling, land on the exact target.
    const guard = setTimeout(() => setV(target), dur + 350)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(guard)
    }
  }, [target, dur])
  return v
}

// ════════════════════════════════════════════════════════════════════════════
// Emoji decoration for known category values
// ════════════════════════════════════════════════════════════════════════════
function emojiFor(value: string): string {
  const v = value.trim()
  const map: Record<string, string> = {
    긍정: '😊',
    중립: '😐',
    부정: '😠',
    조치필요: '🔥',
    '신규(대기)': '🆕',
    회신완료: '✅',
    미회신: '⏳',
    자동분류: '🤖',
    외부고객: '🧑',
    '자동/마케팅': '📢',
    내부: '🏢',
    지연: '⚠️',
    검토필요: '👀',
    KO: '🇰🇷',
    EN: '🇺🇸',
    ZH: '🇨🇳',
  }
  return map[v] ?? ''
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
  emoji,
}: {
  label: string
  accent: string
  title?: string
  onClick?: () => void
  active?: boolean
  emoji?: boolean
}) {
  const e = emoji ? emojiFor(label) : ''
  return (
    <span
      title={title ?? label}
      onClick={onClick}
      className={`chip${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
      style={{
        ['--c' as string]: accent,
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'var(--mono)',
        background: `color-mix(in oklch, ${accent} 13%, transparent)`,
        color: accent,
        border: `1px solid color-mix(in oklch, ${accent} 24%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {e ? <span style={{ fontFamily: 'sans-serif' }}>{e}</span> : <span className="glow-dot" style={{ ['--c' as string]: accent, width: 5, height: 5, background: accent, flexShrink: 0 }} />}
      {label}
    </span>
  )
}

function SectionLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-mute)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span className="glow-dot" style={{ ['--c' as string]: accent, color: accent, width: 6, height: 6, background: accent, display: 'inline-block' }} />
      {label}
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
  primary,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn"
      style={{
        padding: '7px 15px',
        borderRadius: 8,
        border: `1px solid ${primary ? 'color-mix(in oklch, var(--accent) 40%, var(--border))' : 'var(--border)'}`,
        background: primary ? 'color-mix(in oklch, var(--accent) 16%, var(--surface))' : 'var(--surface)',
        color: disabled ? 'var(--text-mute)' : primary ? 'var(--accent)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// KPI card (count-up + clickable)
// ════════════════════════════════════════════════════════════════════════════
function KPICard({
  label,
  value,
  unit,
  accent,
  delay,
  onClick,
  active,
}: {
  label: string
  value: number
  unit?: string
  accent: string
  delay: number
  onClick?: () => void
  active?: boolean
}) {
  const animated = useCountUp(value)
  return (
    <div
      onClick={onClick}
      className={`card lift kpi anim`}
      style={{
        ['--c' as string]: accent,
        animationDelay: `${delay}ms`,
        padding: '18px 20px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, var(--surface), var(--bg-2))',
        border: `1px solid ${active ? `color-mix(in oklch, ${accent} 55%, var(--border))` : `color-mix(in oklch, ${accent} 16%, var(--border))`}`,
        boxShadow: active
          ? `inset 0 1px 0 color-mix(in oklch, white 5%, transparent), 0 0 22px -8px color-mix(in oklch, ${accent} 60%, transparent)`
          : 'inset 0 1px 0 color-mix(in oklch, white 4%, transparent)',
      }}
    >
      <SectionLabel label={label} accent={accent} />
      <div
        className="kpi-num"
        style={{
          ['--c' as string]: accent,
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent,
          lineHeight: 1,
          marginTop: 10,
          fontFamily: 'var(--mono)',
        }}
      >
        {animated.toLocaleString()}
      </div>
      {unit && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>{unit}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Collapsible section
// ════════════════════════════════════════════════════════════════════════════
function Section({
  id,
  title,
  accent,
  isOpen,
  onToggle,
  meta,
  delay,
  innerRef,
  children,
}: {
  id?: string
  title: string
  accent: string
  isOpen: boolean
  onToggle: () => void
  meta?: string
  delay: number
  innerRef?: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      ref={innerRef}
      className="anim"
      style={{
        animationDelay: `${delay}ms`,
        marginBottom: 12,
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'linear-gradient(180deg, var(--surface), var(--bg-2))',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 4%, transparent)',
        scrollMarginTop: 80,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 20px',
          background: isOpen ? 'color-mix(in oklch, var(--surface-2) 60%, transparent)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="glow-dot" style={{ ['--c' as string]: accent, color: accent, width: 7, height: 7, background: accent, display: 'inline-block' }} />
          {title}
          {meta && (
            <span style={{ color: 'var(--text-mute)', fontWeight: 400, fontSize: 11, fontFamily: 'var(--mono)' }}>
              {meta}
            </span>
          )}
        </span>
        <span className={`caret${isOpen ? ' open' : ''}`} style={{ fontSize: 10, color: 'var(--text-mute)' }}>
          ▶
        </span>
      </button>
      {isOpen && <div className="section-body" style={{ padding: '4px 20px 20px' }}>{children}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Donut (animated draw-in + clickable slices)
// ════════════════════════════════════════════════════════════════════════════
function Donut({
  col,
  data,
  accent,
  onPick,
  activeValue,
  mounted,
}: {
  col: string
  data: CatCount[]
  accent: string
  onPick: (value: string) => void
  activeValue?: string
  mounted: boolean
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const top = data.slice(0, 8)
  const r = 52
  const C = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="card" style={{ ['--c' as string]: accent, padding: '14px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <SectionLabel label={col} accent={accent} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12 }}>
        <svg width={120} height={120} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={16} />
          {top.map((d, i) => {
            const frac = total ? d.count / total : 0
            const len = frac * C
            const dash = mounted ? `${len} ${C - len}` : `0 ${C}`
            const dim = activeValue !== undefined && activeValue !== d.label
            const el = (
              <circle
                key={d.label}
                className={`donut-slice${dim ? ' dim' : ''}`}
                cx={70}
                cy={70}
                r={r}
                fill="none"
                stroke={accentFor(i)}
                strokeWidth={activeValue === d.label ? 20 : 16}
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
          <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">
            {total}
          </text>
          <text x={70} y={86} textAnchor="middle" fontSize={11} fill="var(--text-mute)">
            건
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {top.map((d, i) => {
            const dim = activeValue !== undefined && activeValue !== d.label
            const e = emojiFor(d.label)
            return (
              <div
                key={d.label}
                className={`legend-row${dim ? ' dim' : ''}`}
                onClick={() => onPick(d.label)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: accentFor(i), flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>
                  {e && <span style={{ marginRight: 3 }}>{e}</span>}
                  {d.label}
                </span>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11 }}>{d.count}</span>
                <span style={{ color: 'var(--text-mute)', fontSize: 10, width: 34, textAlign: 'right' }}>
                  {total ? Math.round((d.count / total) * 100) : 0}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Sparkline (animated draw-in)
// ════════════════════════════════════════════════════════════════════════════
function Sparkline({ data, accent, mounted }: { data: { dateKey: string; count: number }[]; accent: string; mounted: boolean }) {
  if (data.length < 2) return <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>데이터 부족</div>
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
      <svg width="100%" height={70} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sparkGrad)" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 1s ease 0.3s' }} />
        <polyline
          className="sparkline-path"
          points={line}
          fill="none"
          stroke={accent}
          strokeWidth={0.9}
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={mounted ? 0 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={pts[peak][0]} cy={pts[peak][1]} r={1.8} fill={accent} vectorEffect="non-scaling-stroke" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 0.4s ease 1.1s' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
        <span>{data[0].dateKey}</span>
        <span style={{ color: accent, fontWeight: 600 }}>📈 피크 {data[peak].dateKey} · {data[peak].count}건</span>
        <span>{data[data.length - 1].dateKey}</span>
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
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 3, minWidth: 540 }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ fontSize: 8, color: 'var(--text-mute)', textAlign: 'center' }}>
            {h % 6 === 0 ? h : ''}
          </div>
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
      <div style={{ fontSize: 10, color: 'var(--text-mute)', display: 'flex', alignItems: 'center', paddingRight: 4 }}>
        {WEEKDAYS[wd]}
      </div>
      {row.map((v, h) => (
        <div
          key={h}
          className="heat-cell"
          title={`${WEEKDAYS[wd]}요일 ${h}시 · ${v}건`}
          style={{
            aspectRatio: '1',
            borderRadius: 3,
            background:
              v === 0
                ? 'var(--surface-2)'
                : `color-mix(in oklch, ${accent} ${Math.round((v / max) * 80 + 14)}%, transparent)`,
          }}
        />
      ))}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Ranking bars (animated + clickable)
// ════════════════════════════════════════════════════════════════════════════
function RankBars({
  data,
  accent,
  total,
  unit,
  mounted,
  onPick,
  activeValue,
  emoji,
}: {
  data: CatCount[]
  accent: string
  total: number
  unit: string
  mounted: boolean
  onPick?: (value: string) => void
  activeValue?: string
  emoji?: boolean
}) {
  const top = data.slice(0, 10)
  const max = top.length ? top[0].count : 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {top.map((d, i) => {
        const dim = activeValue !== undefined && activeValue !== d.label
        const e = emoji ? emojiFor(d.label) : ''
        return (
          <div
            key={d.label}
            onClick={onPick ? () => onPick(d.label) : undefined}
            className={onPick ? 'legend-row' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: dim ? 0.34 : 1, transition: 'opacity 0.2s', margin: 0, padding: 0 }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)', width: 18, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, height: 30, borderRadius: 7, position: 'relative', background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div
                className="bar-fill"
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: mounted ? `${(d.count / max) * 100}%` : '0%',
                  background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 26%, transparent), color-mix(in oklch, ${accent} 8%, transparent))`,
                  transitionDelay: `${i * 45}ms`,
                }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 11px' }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>
                  {e && <span style={{ marginRight: 4 }}>{e}</span>}
                  {d.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: accent, flexShrink: 0 }}>
                  {d.count}{unit} · {total ? Math.round((d.count / total) * 100) : 0}%
                </span>
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
  row,
  emailCol,
  longCol,
  urlCol,
  catCols,
  numCols,
  flagCols,
  delay,
}: {
  row: SheetRow
  emailCol?: string
  longCol?: string
  urlCol?: string
  catCols: string[]
  numCols: string[]
  flagCols: string[]
  delay: number
}) {
  const [open, setOpen] = useState(false)
  const draft = longCol ? row[longCol] : ''
  const long = draft.length > 150

  return (
    <div
      className="card lift anim"
      style={{
        ['--c' as string]: 'var(--accent-2)',
        animationDelay: `${delay}ms`,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklch, var(--accent-2) 16%, var(--border))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {emailCol ? extractName(row[emailCol]) : '—'}
        </span>
        {emailCol && (
          <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
            {extractEmail(row[emailCol])}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {catCols.slice(0, 4).map((c, i) => (row[c] ? <Pill key={c} label={row[c]} accent={accentFor(i)} emoji /> : null))}
        {numCols.map((c) => (row[c] ? <Pill key={c} label={`${c.replace(/\(.*\)/, '')} ${row[c]}`} accent="var(--accent-4)" /> : null))}
        {flagCols.map((c) => (row[c] ? <Pill key={c} label={row[c]} accent="var(--accent-2)" emoji /> : null))}
      </div>
      {draft && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            maxHeight: open ? 600 : 60,
            overflow: 'hidden',
            background: 'var(--bg-2)',
            borderRadius: 8,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            transition: 'max-height 0.35s ease',
          }}
        >
          {draft}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {long && (
          <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 11, color: 'var(--accent-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
            {open ? '접기 ▲' : '초안 전체 보기 ▼'}
          </button>
        )}
        {urlCol && row[urlCol]?.startsWith('http') && (
          <a
            href={row[urlCol]}
            target="_blank"
            rel="noopener noreferrer"
            className="linkpill"
            style={{
              fontSize: 11,
              color: 'var(--accent)',
              padding: '4px 11px',
              borderRadius: 999,
              border: '1px solid color-mix(in oklch, var(--accent) 24%, transparent)',
              background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
              marginLeft: 'auto',
              fontWeight: 600,
            }}
          >
            ✉ Gmail 열기
          </a>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Table
// ════════════════════════════════════════════════════════════════════════════
function cellRender(col: string, val: string, type: ColumnType) {
  if (!val) return <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>
  if (type === 'url' && val.startsWith('http'))
    return (
      <a href={val} target="_blank" rel="noopener noreferrer" title={val} className="linkpill" style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 999, background: 'color-mix(in oklch, var(--accent) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)' }}>
        ✉ 열기
      </a>
    )
  if (type === 'flag') return <Pill label={val} accent="var(--accent-2)" emoji />
  if (type === 'email') return <Pill label={extractName(val)} accent="var(--accent-3)" title={extractEmail(val)} />
  if (type === 'category') return <Pill label={val} accent="var(--accent-4)" emoji />
  if (type === 'longtext')
    return (
      <span title={val} style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        {val.length > 46 ? val.slice(0, 46) + '…' : val}
      </span>
    )
  if (type === 'numeric' || type === 'id' || type === 'datetime')
    return <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{val}</span>
  return <span style={{ fontSize: 12 }}>{val}</span>
}

function DataTable({ headers, rows, schema }: { headers: string[]; rows: SheetRow[]; schema: Record<string, ColumnType> }) {
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
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 발신자·분류·부서·내용 검색…"
        style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 12 }}
      />
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {cols.map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-mute)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 600, position: 'sticky', top: 0 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="row-hover" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border) 40%, transparent)' }}>
                {cols.map((c) => (
                  <td key={c} style={{ padding: '8px 12px', maxWidth: 260, whiteSpace: 'nowrap' }}>
                    {cellRender(c, r[c], schema[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-mute)', fontSize: 13 }}>검색 결과가 없습니다</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 8 }}>
        {filtered.length}/{rows.length}건 표시
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ headers, rows, schema, fetchedAt }: Props) {
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
    setToast('✨ 최신 데이터로 갱신했어요')
    setTimeout(() => setToast(''), 2200)
  }

  const openAndScroll = (k: keyof typeof sectionRefs) => {
    setOpen((p) => ({ ...p, [k]: true }))
    setTimeout(() => sectionRefs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // schema groups (full)
  const g = useMemo(() => groupColumnsByType(schema), [schema])
  const dtCol = g.datetime[0]
  const slaCol = g.datetime[1]
  const emailCol = g.email[0]
  const longCol = g.longtext[0]
  const urlCol = g.url[0]
  const flagCols = g.flag
  const catCols = g.category
  const numCols = g.numeric

  // cross-filter view
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

  // KPIs (on view)
  const kpiAccents = ['var(--accent-3)', 'var(--accent-2)', 'var(--accent-4)', 'var(--accent)']
  const kpis: { label: string; value: number; unit?: string; accent: string; onClick?: () => void; active?: boolean }[] = [
    { label: '총 티켓', value: vTotal, unit: filter ? `건 · 전체 ${total}건 중` : '건', accent: kpiAccents[0] },
  ]
  flagCols.forEach((fc) =>
    kpis.push({ label: fc, value: count(fc), unit: `건 · ${pct(count(fc))}%`, accent: 'var(--accent-2)', onClick: () => pickFlag(fc), active: filter?.key === `flag:${fc}` })
  )
  if (replyCol && miLabel) {
    const v = view.filter((r) => (r[replyCol] ?? '').trim() === miLabel).length
    kpis.push({ label: '미회신', value: v, unit: `건 · ${pct(v)}%`, accent: 'var(--accent-4)', onClick: () => pickCat(replyCol, miLabel), active: filter?.key === `${replyCol}:${miLabel}` })
  }
  const kpi4 = kpis.slice(0, 4).map((k, i) => ({ ...k, accent: kpiAccents[i] ?? k.accent }))

  // review
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

  // diagnosis
  const diag: React.ReactNode[] = [<>전체 <Strong color="var(--text)">{total}건</Strong></>]
  if (replyCol && miLabel) {
    const mi = view.filter((r) => (r[replyCol] ?? '').trim() === miLabel).length
    diag.push(<> · 미회신 <Strong color="var(--accent-4)">{mi}건</Strong> ({pct(mi)}%)</>)
  }
  flagCols.forEach((fc) => diag.push(<> · {fc} <Strong color="var(--accent-2)">{count(fc)}건</Strong></>))
  if (statusCol) {
    const ac = view.filter((r) => (r[statusCol] ?? '').trim() === '조치필요').length
    if (ac) diag.push(<> · 조치필요 <Strong color="var(--accent)">{ac}건</Strong></>)
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Toast */}
      {toast && (
        <div className="toast" style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 18px', borderRadius: 999, background: 'color-mix(in oklch, var(--accent) 22%, var(--surface))', border: '1px solid color-mix(in oklch, var(--accent) 45%, transparent)', color: 'var(--text)', fontSize: 13, fontWeight: 600, boxShadow: '0 10px 30px -10px color-mix(in oklch, var(--accent) 60%, transparent)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'color-mix(in oklch, var(--surface) 80%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>📨 메일 트리아지 대시보드</span>
          <Pill label="dummy mail data (사본)" accent="var(--accent-3)" />
          <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>업데이트 {fmt(fetchedAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={toggleAll}>{allOpen ? '⊟ 모두 접기' : '⊞ 모두 펼치기'}</Btn>
          <Btn onClick={refresh} disabled={isPending} primary>
            <span className={isPending ? 'spin' : undefined} style={{ display: 'inline-block', marginRight: 4 }}>↻</span>
            {isPending ? '갱신 중…' : '리프레시'}
          </Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 0' }}>
        {/* Active filter banner */}
        {filter && (
          <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'color-mix(in oklch, var(--accent-3) 14%, var(--surface))', border: '1px solid color-mix(in oklch, var(--accent-3) 35%, var(--border))' }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              🔎 필터 적용: <Strong color="var(--accent-3)">{filter.label}</Strong> · {vTotal}건 ({pct(vTotal, total)}%)
            </span>
            <button onClick={() => setFilter(null)} className="btn" style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              ✕ 필터 해제
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="anim" style={{ animationDelay: '40ms', padding: '18px 24px', borderRadius: 14, marginBottom: 20, background: 'linear-gradient(135deg, color-mix(in oklch, var(--accent) 11%, var(--surface)), color-mix(in oklch, var(--accent-2) 7%, var(--bg-2)))', border: '1px solid color-mix(in oklch, var(--accent) 18%, var(--border))', boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 5%, transparent)' }}>
          <SectionLabel label="진단 요약" accent="var(--accent)" />
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.9, marginTop: 8 }}>
            {diag.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpi4.map((k, i) => (
            <KPICard key={k.label} {...k} delay={80 + i * 70} />
          ))}
        </div>

        {/* Time */}
        {dtCol && (
          <Section id="sec-time" innerRef={sectionRefs.time} title="📈 수신 추이 & 시간대 히트맵" accent="var(--accent-3)" isOpen={open.time} onToggle={() => toggle('time')} meta={`${dtCol}${slaCol ? ` · ${slaCol}` : ''}`} delay={120}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
              <div>
                <SectionLabel label="일자별 수신량" accent="var(--accent-3)" />
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={spark} accent="var(--accent-3)" mounted={mounted} />
                </div>
              </div>
              <div>
                <SectionLabel label="요일 × 시간 히트맵" accent="var(--accent)" />
                <div style={{ marginTop: 10 }}>
                  <Heatmap matrix={heat} accent="var(--accent)" />
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Distribution */}
        {(catCols.length > 0 || numDist.length > 0) && (
          <Section id="sec-dist" innerRef={sectionRefs.dist} title="🍩 분류 · 상태 분포" accent="var(--accent-4)" isOpen={open.dist} onToggle={() => toggle('dist')} meta={`${catCols.length}개 범주 · 클릭해 필터`} delay={150}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
              {catCols.map((c, i) => (
                <Donut key={c} col={c} data={categoryCounts(view, c)} accent={accentFor(i)} mounted={mounted} onPick={(v) => pickCat(c, v)} activeValue={activeCatValue(c)} />
              ))}
            </div>
            {numDist.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                {numDist.map((c) => {
                  const cc = categoryCounts(view, c).sort((a, b) => Number(a.label) - Number(b.label))
                  return (
                    <div key={c} className="card" style={{ ['--c' as string]: 'var(--accent-4)', padding: '14px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <SectionLabel label={`${c} 분포`} accent="var(--accent-4)" />
                      <div style={{ marginTop: 10 }}>
                        <RankBars data={cc} accent="var(--accent-4)" total={vTotal} unit="건" mounted={mounted} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        )}

        {/* Sender */}
        {emailCol && (
          <Section id="sec-sender" innerRef={sectionRefs.sender} title="👤 발신자 분석" accent="var(--accent-2)" isOpen={open.sender} onToggle={() => toggle('sender')} meta={`${emailCol} · 클릭해 필터`} delay={180}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
              <div>
                <SectionLabel label="Top 도메인" accent="var(--accent-2)" />
                <div style={{ marginTop: 10 }}>
                  <RankBars data={domainRanking(view, emailCol)} accent="var(--accent-2)" total={vTotal} unit="건" mounted={mounted} onPick={pickDomain} activeValue={filter?.key.startsWith('dom:') ? filter.key.slice(4) : undefined} />
                </div>
              </div>
              <div>
                <SectionLabel label="Top 발신자" accent="var(--accent-3)" />
                <div style={{ marginTop: 10 }}>
                  <RankBars data={senderRanking(view, emailCol)} accent="var(--accent-3)" total={vTotal} unit="건" mounted={mounted} onPick={pickSender} activeValue={filter?.key.startsWith('snd:') ? filter.key.slice(4) : undefined} />
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Review */}
        {longCol && reviewFlag && (
          <Section id="sec-review" innerRef={sectionRefs.review} title="👀 검토 뷰 — AI 회신초안" accent="var(--accent-2)" isOpen={open.review} onToggle={() => toggle('review')} meta={`${reviewRows.length}건 (${reviewFlag})`} delay={210}>
            {reviewRows.length === 0 ? (
              <div style={{ color: 'var(--text-mute)', fontSize: 13, padding: '12px 0' }}>검토 대상이 없습니다 🎉</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {reviewRows.slice(0, 60).map((r, i) => (
                  <ReviewCard key={i} row={r} emailCol={emailCol} longCol={longCol} urlCol={urlCol} catCols={catCols} numCols={numCols} flagCols={flagCols} delay={Math.min(i * 25, 400)} />
                ))}
              </div>
            )}
            {reviewRows.length > 60 && (
              <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 10 }}>중요도순 상위 60건 표시 · 전체 {reviewRows.length}건</div>
            )}
          </Section>
        )}

        {/* Table */}
        <Section id="sec-table" innerRef={sectionRefs.table} title="📋 전체 데이터 테이블" accent="var(--accent)" isOpen={open.table} onToggle={() => toggle('table')} meta={`${vTotal}건 · ${headers.length}열`} delay={240}>
          <DataTable headers={headers} rows={view} schema={schema} />
        </Section>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-mute)', marginTop: 24 }}>
          STEP 0 자동 스키마 추론 · STEP 2 타입별 시각화 자동 매핑 · 읽기 전용
        </div>
      </main>
    </div>
  )
}

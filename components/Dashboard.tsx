'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition } from 'react'
import type { ColumnType } from '../lib/schema-infer'
import { groupColumnsByType } from '../lib/schema-infer'
import type { SheetRow } from '../lib/sheets'
import {
  parseKST,
  dailyVolume,
  heatmapMatrix,
  matrixMax,
  categoryCounts,
  domainRanking,
  senderRanking,
  extractName,
  extractEmail,
  accentFor,
  type CatCount,
} from '../lib/analyze'

interface Props {
  headers: string[]
  rows: SheetRow[]
  schema: Record<string, ColumnType>
  fetchedAt: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ════════════════════════════════════════════════════════════════════════════
// Atoms
// ════════════════════════════════════════════════════════════════════════════
function Pill({ label, accent, title }: { label: string; accent: string; title?: string }) {
  return (
    <span
      title={title ?? label}
      style={{
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'var(--mono, monospace)',
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
      <span style={{ width: 5, height: 5, borderRadius: 999, background: accent, flexShrink: 0 }} />
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
      <span style={{ color: accent, fontSize: 8 }}>●</span>
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
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: hov && !disabled ? 'var(--surface-2)' : 'var(--surface)',
        color: disabled ? 'var(--text-mute)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 500,
        transition: 'background 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function KPICard({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number | string
  unit?: string
  accent: string
}) {
  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 10,
        background: 'linear-gradient(180deg, var(--surface), var(--bg-2))',
        border: `1px solid color-mix(in oklch, ${accent} 16%, var(--border))`,
        boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 4%, transparent)',
      }}
    >
      <SectionLabel label={label} accent={accent} />
      <div
        style={{
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent,
          lineHeight: 1,
          marginTop: 10,
          fontFamily: 'var(--mono, monospace)',
        }}
      >
        {value}
      </div>
      {unit && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>{unit}</div>}
    </div>
  )
}

function CollapsibleSection({
  title,
  accent,
  isOpen,
  onToggle,
  meta,
  children,
}: {
  title: string
  accent: string
  isOpen: boolean
  onToggle: () => void
  meta?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        marginBottom: 12,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'linear-gradient(180deg, var(--surface), var(--bg-2))',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 4%, transparent)',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-mute)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: accent, fontSize: 8 }}>●</span>
          {title}
          {meta && (
            <span style={{ color: 'var(--text-mute)', textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>
              {meta}
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-mute)',
            transform: isOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
        >
          ▶
        </span>
      </button>
      {isOpen && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Charts (pure SVG/CSS — no chart lib)
// ════════════════════════════════════════════════════════════════════════════
function Donut({ data, accent, title }: { data: CatCount[]; accent: string; title: string }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const top = data.slice(0, 8)
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <SectionLabel label={title} accent={accent} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12 }}>
        <svg width={120} height={120} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={16} />
          {top.map((d, i) => {
            const frac = total ? d.count / total : 0
            const len = frac * c
            const el = (
              <circle
                key={d.label}
                cx={70}
                cy={70}
                r={r}
                fill="none"
                stroke={accentFor(i)}
                strokeWidth={16}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                strokeLinecap="butt"
              />
            )
            offset += len
            return el
          })}
          <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--text)" fontFamily="monospace">
            {total}
          </text>
          <text x={70} y={86} textAnchor="middle" fontSize={11} fill="var(--text-mute)">
            건
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          {top.map((d, i) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: accentFor(i), flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  color: 'var(--text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={d.label}
              >
                {d.label}
              </span>
              <span style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: 11 }}>{d.count}</span>
              <span style={{ color: 'var(--text-mute)', fontSize: 10, width: 34, textAlign: 'right' }}>
                {total ? Math.round((d.count / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Sparkline({ data, accent }: { data: { dateKey: string; count: number }[]; accent: string }) {
  if (data.length < 2) return <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>데이터 부족</div>
  const max = Math.max(...data.map((d) => d.count))
  const W = 100
  const H = 30
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.count / max) * (H - 3) - 1.5
    return [x, y]
  })
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const peak = data.reduce((mx, d, i) => (d.count > data[mx].count ? i : mx), 0)

  return (
    <div>
      <svg width="100%" height={64} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points={area} fill={`color-mix(in oklch, ${accent} 14%, transparent)`} />
        <polyline points={line} fill="none" stroke={accent} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <circle cx={pts[peak][0]} cy={pts[peak][1]} r={1.6} fill={accent} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
        <span>{data[0].dateKey}</span>
        <span style={{ color: accent }}>피크 {data[peak].dateKey} · {data[peak].count}건</span>
        <span>{data[data.length - 1].dateKey}</span>
      </div>
    </div>
  )
}

function Heatmap({ matrix, accent }: { matrix: number[][]; accent: string }) {
  const max = matrixMax(matrix)
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 3, minWidth: 520 }}>
        {/* header hours */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ fontSize: 8, color: 'var(--text-mute)', textAlign: 'center' }}>
            {h % 6 === 0 ? h : ''}
          </div>
        ))}
        {matrix.map((row, wd) => (
          <Row key={wd} wd={wd} row={row} max={max} accent={accent} />
        ))}
      </div>
    </div>
  )
}

function Row({ wd, row, max, accent }: { wd: number; row: number[]; max: number; accent: string }) {
  return (
    <>
      <div style={{ fontSize: 10, color: 'var(--text-mute)', display: 'flex', alignItems: 'center', paddingRight: 4 }}>
        {WEEKDAYS[wd]}
      </div>
      {row.map((v, h) => (
        <div
          key={h}
          title={`${WEEKDAYS[wd]} ${h}시 · ${v}건`}
          style={{
            aspectRatio: '1',
            borderRadius: 3,
            background:
              v === 0
                ? 'var(--surface-2)'
                : `color-mix(in oklch, ${accent} ${Math.round((v / max) * 80 + 12)}%, transparent)`,
            transition: 'transform 0.12s',
            cursor: 'default',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.transform = 'scale(1.4)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.transform = 'scale(1)')}
        />
      ))}
    </>
  )
}

function RankBars({ data, accent, total, unit }: { data: CatCount[]; accent: string; total: number; unit: string }) {
  const top = data.slice(0, 10)
  const max = top.length ? top[0].count : 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {top.map((d, i) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'monospace', width: 18, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, height: 30, borderRadius: 6, position: 'relative', background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: '0 auto 0 0',
                width: `${(d.count / max) * 100}%`,
                background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 24%, transparent), color-mix(in oklch, ${accent} 8%, transparent))`,
              }}
            />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 11px' }}>
              <span style={{ fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>
                {d.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: accent, flexShrink: 0 }}>
                {d.count}{unit} · {total ? Math.round((d.count / total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Review card (longtext + flag)
// ════════════════════════════════════════════════════════════════════════════
function ReviewCard({
  row,
  emailCol,
  longCol,
  urlCol,
  catCols,
  numCols,
  flagCols,
}: {
  row: SheetRow
  emailCol?: string
  longCol?: string
  urlCol?: string
  catCols: string[]
  numCols: string[]
  flagCols: string[]
}) {
  const [open, setOpen] = useState(false)
  const draft = longCol ? row[longCol] : ''
  const long = draft.length > 160

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklch, var(--accent-2) 16%, var(--border))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emailCol ? extractName(row[emailCol]) : '—'}
          </span>
          {emailCol && (
            <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'monospace' }}>
              {extractEmail(row[emailCol])}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {catCols.slice(0, 4).map((c, i) =>
          row[c] ? <Pill key={c} label={`${row[c]}`} accent={accentFor(i)} /> : null
        )}
        {numCols.map((c) => (row[c] ? <Pill key={c} label={`${c.replace(/\(.*\)/, '')} ${row[c]}`} accent="var(--accent-4)" /> : null))}
        {flagCols.map((c) => (row[c] ? <Pill key={c} label={row[c]} accent="var(--accent-2)" /> : null))}
      </div>
      {draft && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            maxHeight: open ? 'none' : 64,
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--bg-2)',
            borderRadius: 8,
            padding: '10px 12px',
            border: '1px solid var(--border)',
          }}
        >
          {draft}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {long && (
          <button
            onClick={() => setOpen((o) => !o)}
            style={{ fontSize: 11, color: 'var(--accent-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {open ? '접기 ▲' : '초안 전체 보기 ▼'}
          </button>
        )}
        {urlCol && row[urlCol]?.startsWith('http') && (
          <a
            href={row[urlCol]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: 'var(--accent)',
              padding: '3px 10px',
              borderRadius: 999,
              border: '1px solid color-mix(in oklch, var(--accent) 24%, transparent)',
              background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
              marginLeft: 'auto',
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
// Data table
// ════════════════════════════════════════════════════════════════════════════
function cellRender(col: string, val: string, type: ColumnType) {
  if (!val) return <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>
  if (type === 'url' && val.startsWith('http'))
    return (
      <a
        href={val}
        target="_blank"
        rel="noopener noreferrer"
        title={val}
        style={{
          color: 'var(--accent)',
          fontSize: 11,
          fontFamily: 'monospace',
          padding: '2px 8px',
          borderRadius: 999,
          background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)',
        }}
      >
        ✉ 열기
      </a>
    )
  if (type === 'flag') return <Pill label={val} accent="var(--accent-2)" />
  if (type === 'email')
    return <Pill label={extractName(val)} accent="var(--accent-3)" title={extractEmail(val)} />
  if (type === 'category') return <Pill label={val} accent="var(--accent-4)" />
  if (type === 'longtext')
    return (
      <span title={val} style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        {val.length > 48 ? val.slice(0, 48) + '…' : val}
      </span>
    )
  if (type === 'numeric' || type === 'id' || type === 'datetime')
    return <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)' }}>{val}</span>
  return <span style={{ fontSize: 12 }}>{val}</span>
}

function DataTable({
  headers,
  rows,
  schema,
}: {
  headers: string[]
  rows: SheetRow[]
  schema: Record<string, ColumnType>
}) {
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
        placeholder="발신자·분류·부서·내용 검색…"
        style={{
          width: '100%',
          padding: '9px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontSize: 13,
          outline: 'none',
          marginBottom: 12,
        }}
      />
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {cols.map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-mute)',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <TR key={i} row={r} cols={cols} schema={schema} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-mute)', fontSize: 13 }}>
            검색 결과가 없습니다
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 8 }}>
        {filtered.length}/{rows.length}건 표시
      </div>
    </div>
  )
}

function TR({ row, cols, schema }: { row: SheetRow; cols: string[]; schema: Record<string, ColumnType> }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px solid color-mix(in oklch, var(--border) 40%, transparent)',
        background: hover ? 'var(--surface-2)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {cols.map((c) => (
        <td key={c} style={{ padding: '8px 12px', maxWidth: 260, whiteSpace: 'nowrap' }}>
          {cellRender(c, row[c], schema[c])}
        </td>
      ))}
    </tr>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ headers, rows, schema, fetchedAt }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [allOpen, setAllOpen] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({
    time: false,
    dist: false,
    sender: false,
    review: false,
    table: false,
  })

  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }))
  const toggleAll = () => {
    const n = !allOpen
    setAllOpen(n)
    setOpen({ time: n, dist: n, sender: n, review: n, table: n })
  }
  const refresh = () => startTransition(() => router.refresh())

  const g = useMemo(() => groupColumnsByType(schema), [schema])
  const dtCol = g.datetime[0]
  const slaCol = g.datetime[1]
  const emailCol = g.email[0]
  const longCol = g.longtext[0]
  const urlCol = g.url[0]
  const flagCols = g.flag
  const catCols = g.category
  const numCols = g.numeric

  const total = rows.length
  const count = (col: string) => rows.filter((r) => (r[col] ?? '').trim()).length
  const countVal = (col: string, val: string) =>
    rows.filter((r) => (r[col] ?? '').trim() === val).length

  // reply column = category col that contains "미회신"
  const replyCol = catCols.find((c) => categoryCounts(rows, c).some((x) => x.label.includes('미회신')))
  const statusCol = catCols.find((c) => categoryCounts(rows, c).some((x) => x.label.includes('조치필요')))

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  // KPIs: total + flags + 미회신
  const kpiAccents = ['var(--accent-3)', 'var(--accent-2)', 'var(--accent-4)', 'var(--accent)']
  const kpis: { label: string; value: number; unit?: string; accent: string }[] = [
    { label: '총 티켓', value: total, unit: '건', accent: kpiAccents[0] },
  ]
  flagCols.forEach((fc) => kpis.push({ label: fc, value: count(fc), unit: `건 · ${pct(count(fc))}%`, accent: 'var(--accent-2)' }))
  if (replyCol) {
    const v = countVal(replyCol, categoryCounts(rows, replyCol).find((x) => x.label.includes('미회신'))!.label)
    kpis.push({ label: '미회신', value: v, unit: `건 · ${pct(v)}%`, accent: 'var(--accent-4)' })
  }
  const kpi4 = kpis.slice(0, 4).map((k, i) => ({ ...k, accent: kpiAccents[i] ?? k.accent }))

  // review rows = flagged 검토필요 (or first flag), sorted by importance desc then 경과 desc
  const reviewFlag = flagCols.find((c) => c.includes('검토')) ?? flagCols[0]
  const impCol = numCols.find((c) => c.includes('중요')) ?? numCols[0]
  const elapsedCol = numCols.find((c) => c.includes('경과'))
  const reviewRows = useMemo(() => {
    if (!reviewFlag) return []
    return rows
      .filter((r) => (r[reviewFlag] ?? '').trim())
      .sort((a, b) => {
        const ia = impCol ? Number(a[impCol]) || 0 : 0
        const ib = impCol ? Number(b[impCol]) || 0 : 0
        if (ib !== ia) return ib - ia
        const ea = elapsedCol ? Number(a[elapsedCol]) || 0 : 0
        const eb = elapsedCol ? Number(b[elapsedCol]) || 0 : 0
        return eb - ea
      })
  }, [rows, reviewFlag, impCol, elapsedCol])

  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  // diagnosis sentence pieces
  const diagParts: React.ReactNode[] = [
    <>전체 <Strong color="var(--text)">{total}건</Strong></>,
  ]
  if (replyCol) {
    const mi = categoryCounts(rows, replyCol).find((x) => x.label.includes('미회신'))
    if (mi) diagParts.push(<> · 미회신 <Strong color="var(--accent-4)">{mi.count}건</Strong> ({pct(mi.count)}%)</>)
  }
  flagCols.forEach((fc) =>
    diagParts.push(<> · {fc} <Strong color="var(--accent-2)">{count(fc)}건</Strong></>)
  )
  if (statusCol) {
    const ac = categoryCounts(rows, statusCol).find((x) => x.label.includes('조치필요'))
    if (ac) diagParts.push(<> · 조치필요 <Strong color="var(--accent)">{ac.count}건</Strong></>)
  }

  const spark = dtCol ? dailyVolume(rows, dtCol) : []
  const heat = dtCol ? heatmapMatrix(rows, dtCol) : []

  // small numeric distributions (<=15 unique) e.g. 중요도
  const numDist = numCols.filter((c) => new Set(rows.map((r) => r[c]).filter(Boolean)).size <= 15)

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in oklch, var(--surface) 85%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>📨 메일 트리아지 대시보드</span>
          <Pill label="dummy mail data (사본)" accent="var(--accent-3)" />
          <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>업데이트 {fmt(fetchedAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={toggleAll}>{allOpen ? '모두 접기' : '모두 펼치기'}</Btn>
          <Btn onClick={refresh} disabled={isPending}>
            {isPending ? '로딩 중…' : '↻ 리프레시'}
          </Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 0' }}>
        {/* Hero */}
        <div
          style={{
            padding: '18px 24px',
            borderRadius: 12,
            marginBottom: 20,
            background:
              'linear-gradient(135deg, color-mix(in oklch, var(--accent) 10%, var(--surface)), color-mix(in oklch, var(--accent-2) 6%, var(--bg-2)))',
            border: '1px solid color-mix(in oklch, var(--accent) 18%, var(--border))',
            boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 5%, transparent)',
          }}
        >
          <SectionLabel label="진단 요약" accent="var(--accent)" />
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.9, marginTop: 8 }}>
            {diagParts.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpi4.map((k) => (
            <KPICard key={k.label} {...k} />
          ))}
        </div>

        {/* Time section */}
        {dtCol && (
          <CollapsibleSection
            title="수신 추이 & 시간대 히트맵"
            accent="var(--accent-3)"
            isOpen={open.time}
            onToggle={() => toggle('time')}
            meta={`${dtCol}${slaCol ? ` · ${slaCol}` : ''}`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
              <div>
                <SectionLabel label="일자별 수신량" accent="var(--accent-3)" />
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={spark} accent="var(--accent-3)" />
                </div>
              </div>
              <div>
                <SectionLabel label="요일 × 시간 히트맵" accent="var(--accent)" />
                <div style={{ marginTop: 10 }}>
                  <Heatmap matrix={heat} accent="var(--accent)" />
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Distribution section */}
        {(catCols.length > 0 || numDist.length > 0) && (
          <CollapsibleSection
            title="분류 · 상태 분포"
            accent="var(--accent-4)"
            isOpen={open.dist}
            onToggle={() => toggle('dist')}
            meta={`${catCols.length}개 범주`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {catCols.map((c, i) => (
                <Donut key={c} data={categoryCounts(rows, c)} accent={accentFor(i)} title={c} />
              ))}
            </div>
            {numDist.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {numDist.map((c, i) => {
                  const cc = categoryCounts(rows, c).sort((a, b) => Number(a.label) - Number(b.label))
                  return (
                    <div key={c} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <SectionLabel label={`${c} 분포`} accent="var(--accent-4)" />
                      <div style={{ marginTop: 10 }}>
                        <RankBars data={cc} accent="var(--accent-4)" total={total} unit="건" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Sender section */}
        {emailCol && (
          <CollapsibleSection
            title="발신자 분석"
            accent="var(--accent-2)"
            isOpen={open.sender}
            onToggle={() => toggle('sender')}
            meta={emailCol}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
              <div>
                <SectionLabel label="Top 도메인" accent="var(--accent-2)" />
                <div style={{ marginTop: 10 }}>
                  <RankBars data={domainRanking(rows, emailCol)} accent="var(--accent-2)" total={total} unit="건" />
                </div>
              </div>
              <div>
                <SectionLabel label="Top 발신자" accent="var(--accent-3)" />
                <div style={{ marginTop: 10 }}>
                  <RankBars data={senderRanking(rows, emailCol)} accent="var(--accent-3)" total={total} unit="건" />
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Review section */}
        {longCol && reviewFlag && (
          <CollapsibleSection
            title="검토 뷰 — AI 회신초안"
            accent="var(--accent-2)"
            isOpen={open.review}
            onToggle={() => toggle('review')}
            meta={`${reviewRows.length}건 (${reviewFlag})`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {reviewRows.map((r, i) => (
                <ReviewCard
                  key={i}
                  row={r}
                  emailCol={emailCol}
                  longCol={longCol}
                  urlCol={urlCol}
                  catCols={catCols}
                  numCols={numCols}
                  flagCols={flagCols}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Full table */}
        <CollapsibleSection
          title="전체 데이터 테이블"
          accent="var(--accent)"
          isOpen={open.table}
          onToggle={() => toggle('table')}
          meta={`${total}건 · ${headers.length}열`}
        >
          <DataTable headers={headers} rows={rows} schema={schema} />
        </CollapsibleSection>
      </main>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition } from 'react'
import type { ColumnType } from '../lib/schema-infer'
import type { SheetRow } from '../lib/sheets'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  headers: string[]
  rows: SheetRow[]
  schema: Record<string, ColumnType>
  fetchedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic primitives
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      style={{
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'monospace',
        background: `color-mix(in oklch, ${accent} 12%, transparent)`,
        color: accent,
        border: `1px solid color-mix(in oklch, ${accent} 22%, transparent)`,
        display: 'inline-block',
        maxWidth: 240,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
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
        background: hov ? 'var(--surface-2)' : 'var(--surface)',
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

function Strong({ children, color }: { children: React.ReactNode; color: string }) {
  return <strong style={{ color, fontWeight: 600 }}>{children}</strong>
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number
  unit: string
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
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>{unit}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Section
// ─────────────────────────────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  accent,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  accent: string
  isOpen: boolean
  onToggle: () => void
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

// ─────────────────────────────────────────────────────────────────────────────
// Table Row
// ─────────────────────────────────────────────────────────────────────────────
function TableRow({ row }: { row: SheetRow }) {
  const [hover, setHover] = useState(false)
  const urlCols = ['1일차 URL', '2일차 URL (오전)', '3일차 URL'] as const

  return (
    <tr
      style={{
        borderBottom: '1px solid color-mix(in oklch, var(--border) 40%, transparent)',
        background: hover ? 'var(--surface-2)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td
        style={{
          padding: '9px 12px',
          color: 'var(--text-mute)',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {row.no}
      </td>
      <td style={{ padding: '9px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {row['이름']}
      </td>
      <td style={{ padding: '9px 12px', fontSize: 12 }}>
        {row['이메일'] ? (
          <Pill label={row['이메일']} accent="var(--accent-2)" />
        ) : (
          <span style={{ color: 'var(--accent-2)', fontSize: 11 }}>—</span>
        )}
      </td>
      {urlCols.map((col) => {
        const val = row[col]
        const isUrl = val?.startsWith('http')
        const isLocal = val?.includes('localhost')
        const isText = val && !isUrl
        return (
          <td key={col} style={{ padding: '9px 12px', maxWidth: 240 }}>
            {isUrl && !isLocal ? (
              <a
                href={val}
                target="_blank"
                rel="noopener noreferrer"
                title={val}
                style={{
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  padding: '2px 9px',
                  borderRadius: 999,
                  background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)',
                  display: 'inline-block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                }}
              >
                🔗 {val.replace(/^https?:\/\//, '')}
              </a>
            ) : isLocal ? (
              <Pill label="localhost" accent="var(--accent-4)" />
            ) : isText ? (
              <span style={{ color: 'var(--accent-2)', fontSize: 12 }}>{val}</span>
            ) : (
              <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>
            )}
          </td>
        )
      })}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ rows, fetchedAt }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [allOpen, setAllOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    email: false,
    url: false,
    table: false,
  })
  const [search, setSearch] = useState('')

  const toggle = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }))

  const toggleAll = () => {
    const next = !allOpen
    setAllOpen(next)
    setOpenSections({ email: next, url: next, table: next })
  }

  const handleRefresh = () => {
    startTransition(() => router.refresh())
  }

  // ── KPI calculations ──────────────────────────────────────────────────────
  const total = rows.length
  const day1 = rows.filter(
    (r) => r['1일차 URL']?.startsWith('http') && !r['1일차 URL'].includes('localhost')
  ).length
  const day2 = rows.filter(
    (r) =>
      r['2일차 URL (오전)']?.startsWith('http') &&
      !r['2일차 URL (오전)'].includes('localhost')
  ).length
  const day3 = rows.filter(
    (r) => r['3일차 URL']?.startsWith('http') && !r['3일차 URL'].includes('localhost')
  ).length
  const issues = rows.filter(
    (r) =>
      !r['이메일']?.trim() ||
      r['1일차 URL']?.includes('localhost') ||
      (r['1일차 URL'] && !r['1일차 URL'].startsWith('http'))
  ).length

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  // ── Email domain ranking ──────────────────────────────────────────────────
  const domainMap: Record<string, number> = {}
  rows.forEach((r) => {
    const email = r['이메일']?.trim()
    if (!email?.includes('@')) return
    const domain = email.split('@')[1]
    domainMap[domain] = (domainMap[domain] ?? 0) + 1
  })
  const domainRanking = Object.entries(domainMap).sort((a, b) => b[1] - a[1])

  const urlCols = [
    { key: '1일차 URL', count: day1, label: '1일차', accent: 'var(--accent)' },
    {
      key: '2일차 URL (오전)',
      count: day2,
      label: '2일차 오전',
      accent: 'var(--accent-4)',
    },
    { key: '3일차 URL', count: day3, label: '3일차', accent: 'var(--accent-3)' },
  ]

  const kpis = [
    { label: '총 참가자', value: total, unit: '명', accent: 'var(--accent-3)' },
    {
      label: '1일차 제출',
      value: day1,
      unit: `명 · ${pct(day1)}%`,
      accent: 'var(--accent)',
    },
    {
      label: '2일차 제출',
      value: day2,
      unit: `명 · ${pct(day2)}%`,
      accent: 'var(--accent-4)',
    },
    { label: '이슈 건수', value: issues, unit: '건', accent: 'var(--accent-2)' },
  ]

  // ── Filtered table ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => Object.values(r).some((v) => v?.toLowerCase().includes(q)))
  }, [rows, search])

  // ── Date formatting ───────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* ── Sticky Header ────────────────────────────────────────────────── */}
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            📊 수강생 제출 현황
          </span>
          <Pill label="dummy mail data" accent="var(--accent-3)" />
          <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            업데이트 {fmt(fetchedAt)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={toggleAll}>{allOpen ? '모두 접기' : '모두 펼치기'}</Btn>
          <Btn onClick={handleRefresh} disabled={isPending}>
            {isPending ? '로딩 중…' : '↻ 리프레시'}
          </Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 0' }}>
        {/* ── Hero Diagnosis Card ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '18px 24px',
            borderRadius: 12,
            marginBottom: 20,
            background:
              'linear-gradient(135deg, color-mix(in oklch, var(--accent) 10%, var(--surface)), color-mix(in oklch, var(--accent-2) 6%, var(--bg-2)))',
            border:
              '1px solid color-mix(in oklch, var(--accent) 18%, var(--border))',
            boxShadow: 'inset 0 1px 0 color-mix(in oklch, white 5%, transparent)',
          }}
        >
          <SectionLabel label="진단 요약" accent="var(--accent)" />
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-dim)',
              lineHeight: 1.9,
              marginTop: 8,
            }}
          >
            전체 <Strong color="var(--text)">{total}명</Strong> 중{' '}
            1일차 <Strong color="var(--accent)">{day1}명</Strong> ({pct(day1)}%) ·{' '}
            2일차 <Strong color="var(--accent-4)">{day2}명</Strong> ({pct(day2)}%) ·{' '}
            3일차 <Strong color="var(--accent-3)">{day3}명</Strong> ({pct(day3)}%) 제출 ·{' '}
            이슈 <Strong color="var(--accent-2)">{issues}건</Strong>
          </p>
        </div>

        {/* ── KPI Band ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {kpis.map((k) => (
            <KPICard key={k.label} {...k} />
          ))}
        </div>

        {/* ── Email Domain Section ────────────────────────────────────────── */}
        <CollapsibleSection
          title="이메일 도메인 분포"
          accent="var(--accent-2)"
          isOpen={openSections.email}
          onToggle={() => toggle('email')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {domainRanking.map(([domain, count], i) => (
              <div
                key={domain}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-mute)',
                    fontVariantNumeric: 'tabular-nums',
                    width: 18,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 6,
                    position: 'relative',
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(count / total) * 100}%`,
                      background:
                        'linear-gradient(90deg, color-mix(in oklch, var(--accent-2) 22%, transparent), color-mix(in oklch, var(--accent-2) 7%, transparent))',
                      transition: 'width 0.6s ease',
                    }}
                  />
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: '100%',
                      padding: '0 12px',
                    }}
                  >
                    <span style={{ fontSize: 13, fontFamily: 'monospace' }}>
                      @{domain}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--accent-2)',
                      }}
                    >
                      {count}명 · {pct(count)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── URL Status Section ──────────────────────────────────────────── */}
        <CollapsibleSection
          title="일차별 URL 제출 현황"
          accent="var(--accent)"
          isOpen={openSections.url}
          onToggle={() => toggle('url')}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            {urlCols.map((col) => (
              <div
                key={col.key}
                style={{
                  padding: '16px 18px',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  border: `1px solid color-mix(in oklch, ${col.accent} 14%, var(--border))`,
                }}
              >
                <SectionLabel label={col.label} accent={col.accent} />
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: col.accent,
                    marginTop: 8,
                    lineHeight: 1,
                  }}
                >
                  {col.count}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    marginBottom: 10,
                    marginTop: 4,
                  }}
                >
                  {pct(col.count)}% 제출
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: 'var(--border)',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct(col.count)}%`,
                      background: col.accent,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
                {/* Per-person dot grid */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {rows.map((row) => {
                    const val = row[col.key]
                    const ok = val?.startsWith('http') && !val.includes('localhost')
                    const local = val?.includes('localhost')
                    const text = val && !val.startsWith('http')
                    return (
                      <span
                        key={row['no']}
                        title={`${row['이름']}: ${val || '미제출'}`}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: ok
                            ? col.accent
                            : local
                            ? 'var(--accent-4)'
                            : text
                            ? 'var(--accent-2)'
                            : 'var(--border)',
                          display: 'inline-block',
                          cursor: 'default',
                          transition: 'transform 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.target as HTMLElement).style.transform = 'scale(1.5)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.target as HTMLElement).style.transform = 'scale(1)'
                        }}
                      />
                    )
                  })}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-mute)',
                    marginTop: 7,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>■ 정상 제출</span>
                  <span style={{ color: 'var(--accent-4)' }}>■ localhost</span>
                  <span style={{ color: 'var(--accent-2)' }}>■ 텍스트</span>
                  <span style={{ color: 'var(--border)' }}>■ 미제출</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Full Table Section ──────────────────────────────────────────── */}
        <CollapsibleSection
          title="전체 데이터 테이블"
          accent="var(--accent-3)"
          isOpen={openSections.table}
          onToggle={() => toggle('table')}
        >
          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 이메일, URL로 검색…"
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          {/* Table */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {[
                    'no',
                    '이름',
                    '이메일',
                    '1일차 URL',
                    '2일차 URL (오전)',
                    '3일차 URL',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 12px',
                        textAlign: 'left',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
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
                {filteredRows.map((row, i) => (
                  <TableRow key={i} row={row} />
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-mute)',
                  fontSize: 13,
                }}
              >
                검색 결과가 없습니다
              </div>
            )}
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 8 }}
          >
            {filteredRows.length}/{total}명 표시
          </div>
        </CollapsibleSection>
      </main>
    </div>
  )
}

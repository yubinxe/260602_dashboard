import type { SheetRow } from './sheets'

// ─────────────────────────────────────────────────────────────────────────────
// Date parsing  ("2026-05-14 12:34" KST style)
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedDate {
  dateKey: string // YYYY-MM-DD
  weekday: number // 0=Sun … 6=Sat
  hour: number // 0..23
  ts: number // epoch ms (local)
}

export function parseKST(raw: string): ParsedDate | null {
  if (!raw) return null
  const m = raw
    .trim()
    .match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, hh, mm] = m
  const year = +y
  const month = +mo - 1
  const day = +d
  const hour = hh ? +hh : 0
  const min = mm ? +mm : 0
  const dt = new Date(year, month, day, hour, min)
  if (isNaN(dt.getTime())) return null
  const dateKey = `${y}-${String(+mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { dateKey, weekday: dt.getDay(), hour, ts: dt.getTime() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily volume → sparkline series
// ─────────────────────────────────────────────────────────────────────────────
export interface DayPoint {
  dateKey: string
  count: number
}

export function dailyVolume(rows: SheetRow[], col: string): DayPoint[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const p = parseKST(r[col])
    if (!p) continue
    map.set(p.dateKey, (map.get(p.dateKey) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([dateKey, count]) => ({ dateKey, count }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekday × Hour heatmap matrix  [7][24]
// ─────────────────────────────────────────────────────────────────────────────
export function heatmapMatrix(rows: SheetRow[], col: string): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const r of rows) {
    const p = parseKST(r[col])
    if (!p) continue
    m[p.weekday][p.hour] += 1
  }
  return m
}

export function matrixMax(m: number[][]): number {
  let max = 0
  for (const row of m) for (const v of row) if (v > max) max = v
  return max
}

// ─────────────────────────────────────────────────────────────────────────────
// Category counts
// ─────────────────────────────────────────────────────────────────────────────
export interface CatCount {
  label: string
  count: number
}

export function categoryCounts(rows: SheetRow[], col: string): CatCount[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const v = (r[col] ?? '').trim()
    if (!v) continue
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// ─────────────────────────────────────────────────────────────────────────────
// Email helpers — handle "이름 <user@domain>" or plain "user@domain"
// ─────────────────────────────────────────────────────────────────────────────
export function extractEmail(raw: string): string {
  if (!raw) return ''
  const angled = raw.match(/<([^>]+)>/)
  const target = angled ? angled[1] : raw
  const m = target.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  return m ? m[0].toLowerCase() : ''
}

export function extractDomain(raw: string): string {
  const email = extractEmail(raw)
  return email.includes('@') ? email.split('@')[1] : ''
}

export function extractName(raw: string): string {
  if (!raw) return ''
  const angled = raw.match(/^([^<]+)</)
  return angled ? angled[1].trim() : extractEmail(raw) || raw.trim()
}

export function domainRanking(rows: SheetRow[], col: string): CatCount[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const dom = extractDomain(r[col])
    if (!dom) continue
    map.set(dom, (map.get(dom) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function senderRanking(rows: SheetRow[], col: string): CatCount[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const email = extractEmail(r[col])
    if (!email) continue
    map.set(email, (map.get(email) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// ─────────────────────────────────────────────────────────────────────────────
// Numeric stats
// ─────────────────────────────────────────────────────────────────────────────
export function numericValues(rows: SheetRow[], col: string): number[] {
  return rows
    .map((r) => Number(r[col]))
    .filter((n) => !isNaN(n) && r_isFinite(n))
}
function r_isFinite(n: number) {
  return Number.isFinite(n)
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette — cycle accent tokens for category slices
// ─────────────────────────────────────────────────────────────────────────────
export const ACCENTS = [
  'var(--accent)',
  'var(--accent-3)',
  'var(--accent-4)',
  'var(--accent-2)',
  'oklch(78% 0.13 320)',
  'oklch(80% 0.13 190)',
  'oklch(85% 0.12 110)',
  'oklch(70% 0.12 260)',
]

export function accentFor(i: number): string {
  return ACCENTS[i % ACCENTS.length]
}

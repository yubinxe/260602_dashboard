export type ColumnType =
  | 'id'
  | 'numeric'
  | 'email'
  | 'url'
  | 'datetime'
  | 'category'
  | 'flag'
  | 'longtext'
  | 'freetext'
  | 'empty'

const DATETIME_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ T]\d{1,2}:\d{2})?/
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const URL_RE = /^https?:\/\//

export function inferColumnType(header: string, values: string[]): ColumnType {
  const h = header.trim()
  if (!h) return 'empty'
  const nonEmpty = values.filter((v) => v?.trim())
  if (nonEmpty.length === 0) return 'empty'

  const lh = h.toLowerCase()

  // ── header keyword hints ──────────────────────────────────────────────
  if (lh === 'no' || lh === 'num' || lh.includes('id') || h === '번호' || h.includes('티켓id'))
    return /id/i.test(h) || h.includes('티켓') ? 'id' : 'numeric'
  if (lh.includes('url') || lh.includes('링크') || lh.includes('link')) return 'url'
  if (lh.includes('mail') && lh.includes('링크')) return 'url'
  if (h.includes('일시') || h.includes('기한') || h.includes('수신') || lh.includes('date') || lh.includes('time'))
    return 'datetime'

  // ── value-based inference ─────────────────────────────────────────────
  const ratio = (re: RegExp) =>
    nonEmpty.filter((v) => re.test(v)).length / nonEmpty.length

  if (ratio(URL_RE) > 0.6) return 'url'
  if (ratio(DATETIME_RE) > 0.6) return 'datetime'
  if (ratio(EMAIL_RE) > 0.6) return 'email'

  const numRatio =
    nonEmpty.filter((v) => /^-?\d+(\.\d+)?$/.test(v)).length / nonEmpty.length
  if (numRatio > 0.85) return 'numeric'

  const uniq = new Set(nonEmpty)
  const coverage = nonEmpty.length / values.length // share of rows that are filled

  // flag = single distinct value present in only some rows (e.g. "지연", "검토필요")
  if (uniq.size === 1 && coverage < 0.95) return 'flag'

  const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length
  if (avgLen > 60) return 'longtext'

  // category = limited distinct values
  if (uniq.size <= Math.max(12, values.length * 0.15)) return 'category'

  return 'freetext'
}

export function buildSchema(
  headers: string[],
  rows: Record<string, string>[]
): Record<string, ColumnType> {
  return headers.reduce(
    (acc, h) => {
      if (!h.trim()) return acc
      const vals = rows.map((r) => r[h] ?? '')
      acc[h] = inferColumnType(h, vals)
      return acc
    },
    {} as Record<string, ColumnType>
  )
}

/** Group header names by inferred type for the dashboard's auto-mapping. */
export function groupColumnsByType(schema: Record<string, ColumnType>) {
  const out: Record<ColumnType, string[]> = {
    id: [],
    numeric: [],
    email: [],
    url: [],
    datetime: [],
    category: [],
    flag: [],
    longtext: [],
    freetext: [],
    empty: [],
  }
  for (const [name, type] of Object.entries(schema)) out[type].push(name)
  return out
}

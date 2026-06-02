export type ColumnType =
  | 'numeric'
  | 'email'
  | 'url'
  | 'freetext'
  | 'datetime'
  | 'category'
  | 'boolean'
  | 'longtext'
  | 'empty'

export function inferColumnType(header: string, values: string[]): ColumnType {
  if (!header.trim()) return 'empty'
  const nonEmpty = values.filter((v) => v?.trim())
  if (nonEmpty.length === 0) return 'empty'

  const lh = header.toLowerCase()

  // Explicit keyword hints
  if (lh === 'no' || lh === 'num' || lh === '번호') return 'numeric'
  if (lh.includes('이메일') || lh.includes('email') || lh.includes('mail')) return 'email'
  if (lh.includes('url') || lh.includes('링크') || lh.includes('link')) return 'url'
  if (lh.includes('날짜') || lh.includes('date') || lh.includes('일시')) return 'datetime'
  if (lh.includes('여부') || lh === 'yn' || lh === 'flag') return 'boolean'

  // Value-based inference
  const urlRatio =
    nonEmpty.filter((v) => /^https?:\/\//.test(v)).length / nonEmpty.length
  if (urlRatio > 0.5) return 'url'

  const emailRatio =
    nonEmpty.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length / nonEmpty.length
  if (emailRatio > 0.5) return 'email'

  const numRatio =
    nonEmpty.filter((v) => !isNaN(Number(v))).length / nonEmpty.length
  if (numRatio > 0.8) return 'numeric'

  const boolRatio =
    nonEmpty.filter((v) => ['true', 'false', 'y', 'n', '예', '아니오', '○', '×'].includes(v.toLowerCase())).length /
    nonEmpty.length
  if (boolRatio > 0.7) return 'boolean'

  const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length
  if (avgLen > 80) return 'longtext'

  const unique = new Set(nonEmpty).size
  if (unique <= 5 && nonEmpty.length > 5) return 'category'

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

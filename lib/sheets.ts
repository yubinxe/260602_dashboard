import { google } from 'googleapis'

export interface SheetRow {
  no: string
  이름: string
  이메일: string
  '1일차 URL': string
  '2일차 URL (오전)': string
  '3일차 URL': string
  [key: string]: string
}

export interface SheetData {
  headers: string[]
  rows: SheetRow[]
  fetchedAt: string
}

export async function fetchSheetData(): Promise<SheetData> {
  const sheetId =
    process.env.GOOGLE_SHEETS_ID ?? '1zVrJhs_0sB3wSP-vpV23usjBfS7zfPeBi8oTx_jZ9qw'
  const gid = process.env.GOOGLE_SHEET_GID ?? '1234434521'
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const fetchedAt = new Date().toISOString()

  // Service account path
  if (saJson && !saJson.startsWith('여기에')) {
    try {
      const credentials = JSON.parse(saJson)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      })
      const sheets = google.sheets({ version: 'v4', auth })
      const tab = process.env.GOOGLE_SHEET_TAB ?? 'dummy mail data'
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: tab,
      })
      const rawRows = (res.data.values ?? []) as string[][]
      if (rawRows.length === 0) return { headers: [], rows: [], fetchedAt }

      const headers = rawRows[0].map((h) => h?.trim() ?? '').filter(Boolean)
      const rows = parseRows(headers, rawRows.slice(1))
      return { headers, rows, fetchedAt }
    } catch (e) {
      console.error('[sheets] Service account failed, fallback to public CSV:', e)
    }
  }

  // Public CSV fallback (works for publicly shared sheets)
  return fetchPublicCSV(sheetId, gid, fetchedAt)
}

async function fetchPublicCSV(
  sheetId: string,
  gid: string,
  fetchedAt: string
): Promise<SheetData> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`)
  const text = await res.text()

  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [], fetchedAt }

  const headers = parseCSVLine(lines[0]).filter(Boolean)
  const rows = parseRows(
    headers,
    lines.slice(1).map(parseCSVLine)
  )
  return { headers, rows, fetchedAt }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parseRows(headers: string[], rawRows: string[][]): SheetRow[] {
  return rawRows
    .filter((row) => row.some((cell) => cell?.trim()))
    .map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = (row[i] ?? '').trim()
      })
      return obj as SheetRow
    })
    .filter((row) => row['이름']?.trim())
}

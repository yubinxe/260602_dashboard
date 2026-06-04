import { google } from 'googleapis'

/** A sheet row is a generic header→value map (schema is NOT hardcoded). */
export type SheetRow = Record<string, string>

export interface SheetData {
  headers: string[]
  rows: SheetRow[]
  fetchedAt: string
}

const DEFAULT_SHEET_ID = '1zVrJhs_0sB3wSP-vpV23usjBfS7zfPeBi8oTx_jZ9qw'
const DEFAULT_GID = '603004030'

export async function fetchSheetData(): Promise<SheetData> {
  const sheetId = process.env.GOOGLE_SHEETS_ID ?? DEFAULT_SHEET_ID
  const gid = process.env.GOOGLE_SHEET_GID ?? DEFAULT_GID
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const fetchedAt = new Date().toISOString()

  // ── Service account path (spreadsheets.readonly) ──────────────────────────
  if (saJson && !saJson.startsWith('여기에')) {
    try {
      const credentials = JSON.parse(saJson)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      })
      const sheets = google.sheets({ version: 'v4', auth })
      const tab = process.env.GOOGLE_SHEET_TAB ?? 'dummy mail data의 사본'
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: tab,
      })
      const rawRows = (res.data.values ?? []) as string[][]
      if (rawRows.length === 0) return { headers: [], rows: [], fetchedAt }
      const headers = rawRows[0].map((h) => (h ?? '').trim()).filter(Boolean)
      const rows = parseRows(headers, rawRows.slice(1))
      return { headers, rows, fetchedAt }
    } catch (e) {
      console.error('[sheets] Service account failed, fallback to public CSV:', e)
    }
  }

  // ── Public CSV fallback (publicly shared sheet) ───────────────────────────
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

  const records = parseCSV(text)
  if (records.length === 0) return { headers: [], rows: [], fetchedAt }

  const headers = records[0].map((h) => h.trim()).filter(Boolean)
  const rows = parseRows(headers, records.slice(1))
  return { headers, rows, fetchedAt }
}

/**
 * Full RFC-4180-ish CSV parser that correctly handles quoted fields
 * containing commas AND embedded newlines (the AI 회신초안 column has them).
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        row.push(cur)
        cur = ''
      } else if (ch === '\n') {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ''
      } else if (ch === '\r') {
        // ignore; handled by \n
      } else {
        cur += ch
      }
    }
  }
  // flush last field/row
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function parseRows(headers: string[], rawRows: string[][]): SheetRow[] {
  return rawRows
    .filter((row) => row.some((cell) => (cell ?? '').trim()))
    .map((row) => {
      const obj: SheetRow = {}
      headers.forEach((h, i) => {
        obj[h] = (row[i] ?? '').trim()
      })
      return obj
    })
    // keep a row only if its first column (id-like) or any cell has content
    .filter((row) => Object.values(row).some((v) => v))
}

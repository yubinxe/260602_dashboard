import { NextResponse } from 'next/server'
import { fetchSheetData } from '../../../lib/sheets'
import { buildSchema } from '../../../lib/schema-infer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { headers, rows, fetchedAt } = await fetchSheetData()
    const schema = buildSchema(headers, rows)
    return NextResponse.json({ headers, rows, schema, fetchedAt })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

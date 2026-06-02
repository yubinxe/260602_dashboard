import { fetchSheetData } from '../lib/sheets'
import { buildSchema } from '../lib/schema-infer'
import Dashboard from '../components/Dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Page() {
  let data
  try {
    const { headers, rows, fetchedAt } = await fetchSheetData()
    const schema = buildSchema(headers, rows)
    data = { headers, rows, schema, fetchedAt }
  } catch (e) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div
          style={{
            padding: '24px 32px',
            borderRadius: 12,
            border: '1px solid color-mix(in oklch, oklch(72% 0.16 28) 30%, oklch(26% 0.015 250))',
            background: 'oklch(17% 0.013 250)',
            color: 'oklch(72% 0.16 28)',
            fontFamily: 'monospace',
            fontSize: 14,
          }}
        >
          <strong>⚠ 시트 로드 실패</strong>
          <br />
          <span style={{ opacity: 0.7 }}>{String(e)}</span>
        </div>
      </div>
    )
  }
  return <Dashboard {...data} />
}

import { fetchSheetData } from '../lib/sheets'
import { buildSchema } from '../lib/schema-infer'
import IntroGate from '../components/IntroGate'
import { loginWithGoogle, logout } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getSession() {
  try {
    const { auth } = await import('../auth')
    return await auth()
  } catch {
    return null
  }
}

export default async function Page() {
  const session = await getSession()

  let data
  try {
    const { headers, rows, fetchedAt } = await fetchSheetData()
    const schema = buildSchema(headers, rows)
    data = { headers, rows, schema, fetchedAt }
  } catch (e) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ padding: '24px 32px', borderRadius: 18, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--terracotta)', fontSize: 14, boxShadow: 'var(--sh-2)' }}>
          <strong>시트 로드 실패</strong>
          <br />
          <span style={{ opacity: 0.7 }}>{String(e)}</span>
        </div>
      </div>
    )
  }

  return <IntroGate data={data} authed={!!session} login={loginWithGoogle} logout={logout} />
}

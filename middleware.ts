// Skip auth middleware entirely if OAuth credentials are not configured (dev mode).
// When GOOGLE_CLIENT_ID is set, use next-auth's auth() as middleware.
export { auth as middleware } from './auth'

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}

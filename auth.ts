import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const allowedDomains = (process.env.ALLOWED_HOSTED_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Dev mode: no domains configured → allow all
      if (!allowedDomains.length) return true
      if (!process.env.GOOGLE_CLIENT_ID) return true
      const email = profile?.email ?? ''
      return allowedDomains.some((d) => email.endsWith(`@${d}`))
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

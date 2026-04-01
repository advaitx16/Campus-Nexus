import { type NextRequest, NextResponse } from 'next/server'

export default async function proxy(request: NextRequest) {
  // Allow all traffic in demo mode — no auth required to browse the app.
  // To enable full Supabase session management, replace the line below with:
  //   const { updateSession } = await import('@/lib/middleware')
  //   return updateSession(request)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

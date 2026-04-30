import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/Admin')) {
    const targetPath = pathname === '/Admin' ? '/admin' : pathname.replace(/^\/Admin/, '/admin')
    return NextResponse.redirect(new URL(`${targetPath}${search}`, request.url), 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/Admin/:path*'],
}

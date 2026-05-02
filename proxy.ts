import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/Admin')) {
    const targetPath = pathname === '/Admin' ? '/admin' : pathname.replace(/^\/Admin/, '/admin')
    return NextResponse.redirect(new URL(`${targetPath}${search}`, request.url), 308)
  }

  if (pathname === '/internal-admin' || pathname.startsWith('/internal-admin/')) {
    const targetPath = pathname.replace(/^\/internal-admin/, '/admin')
    return NextResponse.redirect(new URL(`${targetPath}${search}`, request.url), 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/Admin/:path*', '/internal-admin/:path*'],
}

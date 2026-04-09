import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 需要登录才能访问的路径
const protectedPaths = ['/dashboard', '/tutoring', '/growth', '/profile', '/teacher']

// 已登录用户不能访问的路径（如登录页）
const authPaths = ['/login', '/register']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 从 cookie 或 localStorage 检查登录状态
  // 注意：proxy 中无法直接访问 localStorage，需要通过 cookie
  const token = request.cookies.get('token')?.value

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = authPaths.some(path => pathname === path)

  // 如果访问受保护路径但没有 token，重定向到登录页
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 如果已登录但访问登录/注册页，重定向到仪表盘
  if (isAuthPath && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

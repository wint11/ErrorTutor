import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_errortutor'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string }
  } catch {
    return null
  }
}

export function getRequestToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (bearerToken) {
    return bearerToken
  }

  const cookieToken = request.cookies.get('token')?.value?.trim()
  return cookieToken || null
}

export function getAuthPayload(request: NextRequest) {
  const token = getRequestToken(request)

  if (!token) {
    return null
  }

  return verifyToken(token)
}

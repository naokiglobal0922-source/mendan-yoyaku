import { NextRequest } from 'next/server'

export function checkAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Basic ')) return false

  const base64 = authHeader.slice(6)
  const decoded = Buffer.from(base64, 'base64').toString('utf-8')
  const [, password] = decoded.split(':')
  return password === process.env.ADMIN_PASSWORD
}

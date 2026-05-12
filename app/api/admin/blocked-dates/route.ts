import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { getBlockedDates, addBlockedDate, removeBlockedDate } from '@/lib/google'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } })
  }
  const dates = await getBlockedDates()
  return NextResponse.json({ dates })
}

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } })
  }
  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: '日付が必要です' }, { status: 400 })
  await addBlockedDate(date)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } })
  }
  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: '日付が必要です' }, { status: 400 })
  await removeBlockedDate(date)
  return NextResponse.json({ success: true })
}

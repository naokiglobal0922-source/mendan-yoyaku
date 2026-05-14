import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { updateInterviewRecord, getSpreadsheetId } from '@/lib/google'

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const { name, date, teacherId } = await request.json()
  if (!name || !date) return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  const spreadsheetId = getSpreadsheetId(teacherId ?? 'haraguchi')
  await updateInterviewRecord(spreadsheetId, name, date)
  return NextResponse.json({ success: true })
}

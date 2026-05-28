import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient, getSpreadsheetId, getSlotStatusForDate } from '@/lib/google'

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  const teacherId = request.nextUrl.searchParams.get('teacher')
  if (!date || !teacherId) return NextResponse.json({ error: 'date and teacher required' }, { status: 400 })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)

    // slot status with debug info
    const slots = await getSlotStatusForDate(spreadsheetId, date, undefined, undefined, teacherId, true)

    // also raw header
    const sheets = await getSheetsClient()
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: '2026!1:1' })
    const headers = (headerRes.data.values || [[]])[0]

    return NextResponse.json({ date, headers, slots })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

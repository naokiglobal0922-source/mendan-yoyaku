import { NextRequest, NextResponse } from 'next/server'
import { getBlockedDates, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  const teacherId = request.nextUrl.searchParams.get('teacher')
  if (!teacherId) return NextResponse.json({ dates: [] })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const dates = await getBlockedDates(spreadsheetId)
    return NextResponse.json({ dates })
  } catch {
    return NextResponse.json({ dates: [] })
  }
}

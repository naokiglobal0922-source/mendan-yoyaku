import { NextRequest, NextResponse } from 'next/server'
import { getWeekAvailability, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  const datesParam = request.nextUrl.searchParams.get('dates')
  const teacherId = request.nextUrl.searchParams.get('teacher')
  const schoolId = request.nextUrl.searchParams.get('school') ?? undefined
  if (!datesParam) return NextResponse.json({ error: 'dates required' }, { status: 400 })
  if (!teacherId) return NextResponse.json({ error: 'teacher required' }, { status: 400 })

  const dates = datesParam.split(',').filter(Boolean)

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const availability = await getWeekAvailability(spreadsheetId, dates, schoolId, teacherId)
    return NextResponse.json({ availability })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

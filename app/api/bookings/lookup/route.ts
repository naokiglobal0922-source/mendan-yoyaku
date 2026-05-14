import { NextRequest, NextResponse } from 'next/server'
import { findBookingsByName, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')
  const teacherId = request.nextUrl.searchParams.get('teacher')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!teacherId) return NextResponse.json({ error: 'teacher required' }, { status: 400 })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const bookings = await findBookingsByName(spreadsheetId, name.trim())
    return NextResponse.json({ bookings })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

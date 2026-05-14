import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { getBookings, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  const teacherId = request.nextUrl.searchParams.get('teacher') ?? 'haraguchi'

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const bookings = await getBookings(spreadsheetId)
    return NextResponse.json({ bookings })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

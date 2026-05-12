import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { getBookings } from '@/lib/google'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  try {
    const bookings = await getBookings()
    return NextResponse.json({ bookings })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

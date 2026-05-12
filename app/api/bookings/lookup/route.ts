import { NextRequest, NextResponse } from 'next/server'
import { findBookingsByName } from '@/lib/google'

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  try {
    const bookings = await findBookingsByName(name.trim())
    return NextResponse.json({ bookings })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

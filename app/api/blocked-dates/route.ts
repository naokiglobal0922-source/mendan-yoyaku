import { NextResponse } from 'next/server'
import { getBlockedDates } from '@/lib/google'

export async function GET() {
  try {
    const dates = await getBlockedDates()
    return NextResponse.json({ dates })
  } catch {
    return NextResponse.json({ dates: [] })
  }
}

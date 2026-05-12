import { NextRequest, NextResponse } from 'next/server'
import { BOOKABLE_SLOTS, isSlotBooked, writeBooking } from '@/lib/google'
import { sendLineNotification } from '@/lib/line'

// GET /api/bookings?date=4/1  → その日の空き状況
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  try {
    const slotStatus = await Promise.all(
      BOOKABLE_SLOTS.map(async (slot) => {
        const booked = await isSlotBooked(date, slot)
        return { slot, booked: booked ?? null }
      })
    )
    return NextResponse.json({ date, slots: slotStatus })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/bookings  → 予約確定
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, slot, studentName, type, note } = body

    if (!date || !slot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 既に予約済みか確認
    const existing = await isSlotBooked(date, slot)
    if (existing) {
      return NextResponse.json({ error: 'この枠は既に予約済みです' }, { status: 409 })
    }

    await writeBooking(date, slot, studentName)

    // LINE通知
    const msg = `【面談予約】\n生徒名: ${studentName}\n日時: ${date} ${slot}\n種別: ${type}\n${note ? `備考: ${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

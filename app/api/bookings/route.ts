import { NextRequest, NextResponse } from 'next/server'
import { BOOKABLE_SLOTS, isSlotBooked, writeBooking, cancelBooking } from '@/lib/google'
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

// POST /api/bookings  → 新規予約
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, slot, studentName, type, note } = body

    if (!date || !slot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const existing = await isSlotBooked(date, slot)
    if (existing) {
      return NextResponse.json({ error: 'この枠は既に予約済みです' }, { status: 409 })
    }

    await writeBooking(date, slot, studentName, type)

    const msg = `【面談予約】\n生徒名: ${studentName}\n日時: ${date} ${slot}\n種別: ${type}\n${note ? `\n${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/bookings  → 予約変更（旧枠を消して新枠に書き込み）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, oldSlot, newSlot, studentName, type, note } = body

    if (!date || !oldSlot || !newSlot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 新しいスロットが別の枠で既に埋まっていないか確認
    if (oldSlot !== newSlot) {
      const existing = await isSlotBooked(date, newSlot)
      if (existing) {
        return NextResponse.json({ error: '変更先の枠は既に予約済みです' }, { status: 409 })
      }
    }

    // 旧枠をキャンセル
    await cancelBooking(date, oldSlot)
    // 新枠に書き込み
    await writeBooking(date, newSlot, studentName, type)

    const msg = `【面談予約変更】\n生徒名: ${studentName}\n変更前: ${date} ${oldSlot}\n変更後: ${date} ${newSlot}\n種別: ${type}\n${note ? `\n${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/bookings  → 予約キャンセル
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, slot, studentName } = body

    if (!date || !slot) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    await cancelBooking(date, slot)

    const msg = `【面談予約キャンセル】\n生徒名: ${studentName || '不明'}\n日時: ${date} ${slot}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

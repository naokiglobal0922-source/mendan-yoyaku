import { NextRequest, NextResponse } from 'next/server'
import { getSlotStatusForDate, writeBooking, cancelBooking } from '@/lib/google'
import { sendLineNotification } from '@/lib/line'

// GET /api/bookings?date=4/1&excludeSlot=15:00  → その日の空き状況
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  const excludeSlot = request.nextUrl.searchParams.get('excludeSlot') ?? undefined
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  try {
    const slots = await getSlotStatusForDate(date, excludeSlot)
    return NextResponse.json({ date, slots })
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

    // 45分バッファ込みで空き確認
    const slots = await getSlotStatusForDate(date)
    const target = slots.find(s => s.slot === slot)
    if (target?.booked) {
      return NextResponse.json({ error: 'この枠は予約できません（予約済みまたは直前に別の予定があります）' }, { status: 409 })
    }

    await writeBooking(date, slot, studentName, type, note || undefined)

    const msg = `【面談予約】\n生徒名: ${studentName}\n日時: ${date} ${slot}\n種別: ${type}\n${note ? `\n${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/bookings  → 予約変更
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, oldSlot, newSlot, studentName, type, note } = body

    if (!date || !oldSlot || !newSlot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    if (oldSlot !== newSlot) {
      const slots = await getSlotStatusForDate(date, oldSlot)
      const target = slots.find(s => s.slot === newSlot)
      if (target?.booked) {
        return NextResponse.json({ error: '変更先の枠は予約できません' }, { status: 409 })
      }
    }

    await cancelBooking(date, oldSlot)
    await writeBooking(date, newSlot, studentName, type, note || undefined)

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

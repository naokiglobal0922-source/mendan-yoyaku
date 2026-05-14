import { NextRequest, NextResponse } from 'next/server'
import { getSlotStatusForDate, writeBooking, cancelBooking, getSpreadsheetId } from '@/lib/google'
import { sendLineNotification } from '@/lib/line'

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  const excludeSlot = request.nextUrl.searchParams.get('excludeSlot') ?? undefined
  const teacherId = request.nextUrl.searchParams.get('teacher')
  const schoolId = request.nextUrl.searchParams.get('school') ?? undefined
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  if (!teacherId) return NextResponse.json({ error: 'teacher required' }, { status: 400 })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const isDebug = request.nextUrl.searchParams.get('_debug') === '1'
    const slots = await getSlotStatusForDate(spreadsheetId, date, excludeSlot, schoolId, isDebug)
    return NextResponse.json({ date, slots })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, schoolId, date, slot, studentName, type, note } = body

    if (!teacherId || !date || !slot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const spreadsheetId = getSpreadsheetId(teacherId)
    const slots = await getSlotStatusForDate(spreadsheetId, date, undefined, schoolId)
    const target = slots.find(s => s.slot === slot)
    if (target?.booked) {
      return NextResponse.json({ error: 'この枠は予約できません（予約済みまたは直前に別の予定があります）' }, { status: 409 })
    }

    await writeBooking(spreadsheetId, date, slot, studentName, type, note || undefined)

    const msg = `【面談予約】\n生徒名: ${studentName}\n日時: ${date} ${slot}\n種別: ${type}\n${note ? `\n${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, schoolId, date, oldSlot, newSlot, studentName, type, note } = body

    if (!teacherId || !date || !oldSlot || !newSlot || !studentName || !type) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const spreadsheetId = getSpreadsheetId(teacherId)

    if (oldSlot !== newSlot) {
      const slots = await getSlotStatusForDate(spreadsheetId, date, oldSlot, schoolId)
      const target = slots.find(s => s.slot === newSlot)
      if (target?.booked) {
        return NextResponse.json({ error: '変更先の枠は予約できません' }, { status: 409 })
      }
    }

    await cancelBooking(spreadsheetId, date, oldSlot)
    await writeBooking(spreadsheetId, date, newSlot, studentName, type, note || undefined)

    const msg = `【面談予約変更】\n生徒名: ${studentName}\n変更前: ${date} ${oldSlot}\n変更後: ${date} ${newSlot}\n種別: ${type}\n${note ? `\n${note}` : ''}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, date, slot, studentName } = body

    if (!teacherId || !date || !slot) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const spreadsheetId = getSpreadsheetId(teacherId)
    await cancelBooking(spreadsheetId, date, slot)

    const msg = `【面談予約キャンセル】\n生徒名: ${studentName || '不明'}\n日時: ${date} ${slot}`
    await sendLineNotification(msg)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

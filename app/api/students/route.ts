import { NextRequest, NextResponse } from 'next/server'
import { getStudents, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  const teacherId = request.nextUrl.searchParams.get('teacher')
  if (!teacherId) return NextResponse.json({ error: 'teacher required' }, { status: 400 })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const students = await getStudents(spreadsheetId)
    return NextResponse.json({ students })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

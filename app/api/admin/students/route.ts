import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { getStudents, addStudent, deleteStudent, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const teacherId = request.nextUrl.searchParams.get('teacher') ?? 'haraguchi'
  const spreadsheetId = getSpreadsheetId(teacherId)
  const students = await getStudents(spreadsheetId)
  return NextResponse.json({ students })
}

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const { name, teacherId } = await request.json()
  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  const spreadsheetId = getSpreadsheetId(teacherId ?? 'haraguchi')
  await addStudent(spreadsheetId, name)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const { name, teacherId } = await request.json()
  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  const spreadsheetId = getSpreadsheetId(teacherId ?? 'haraguchi')
  await deleteStudent(spreadsheetId, name)
  return NextResponse.json({ success: true })
}

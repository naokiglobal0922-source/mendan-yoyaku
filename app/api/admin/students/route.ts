import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { getStudents, addStudent, deleteStudent } from '@/lib/google'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const students = await getStudents()
  return NextResponse.json({ students })
}

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  await addStudent(name)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }
  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  await deleteStudent(name)
  return NextResponse.json({ success: true })
}

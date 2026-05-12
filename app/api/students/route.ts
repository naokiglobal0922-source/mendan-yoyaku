import { NextResponse } from 'next/server'
import { getStudents } from '@/lib/google'

export async function GET() {
  try {
    const students = await getStudents()
    return NextResponse.json({ students })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

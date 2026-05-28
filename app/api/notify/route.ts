import { NextRequest, NextResponse } from 'next/server'

// LINE Webhookエンドポイント
export async function POST(request: NextRequest) {
  try {
    await request.json()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient, getSpreadsheetId } from '@/lib/google'

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  const teacherId = request.nextUrl.searchParams.get('teacher')
  if (!date || !teacherId) return NextResponse.json({ error: 'date and teacher required' }, { status: 400 })

  try {
    const spreadsheetId = getSpreadsheetId(teacherId)
    const sheets = await getSheetsClient()

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '2026!1:1',
    })
    const headers = (headerRes.data.values || [[]])[0] as string[]

    const colARes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '2026!A:A',
    })
    const rows = (colARes.data.values || []) as string[][]
    let rowIndex = -1
    let currentMonth = 0
    const [targetMonth, targetDay] = date.split('/').map(Number)
    for (let i = 0; i < rows.length; i++) {
      const cell = (rows[i]?.[0] ?? '').toString().trim()
      if (!cell) continue
      if (cell.includes('/')) {
        const [m, d] = cell.split('/').map(Number)
        currentMonth = m
        if (m === targetMonth && d === targetDay) { rowIndex = i; break }
      } else {
        const d = Number(cell)
        if (!isNaN(d) && currentMonth === targetMonth && d === targetDay) { rowIndex = i; break }
      }
    }

    if (rowIndex < 0) return NextResponse.json({ error: `Date ${date} not found` }, { status: 404 })

    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`2026!A${rowIndex + 1}:AM${rowIndex + 1}`],
      includeGridData: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cells = (res.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || []) as any[]

    const result = cells.map((cell, i) => ({
      col: i,
      header: headers[i] || `col${i}`,
      value: cell?.formattedValue || '',
      backgroundColor: cell?.effectiveFormat?.backgroundColor ?? null,
    }))

    return NextResponse.json({ date, rowIndex, cells: result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

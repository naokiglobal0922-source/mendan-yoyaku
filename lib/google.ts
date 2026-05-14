import { google } from 'googleapis'

export function getSpreadsheetId(teacherId: string): string {
  const map: Record<string, string | undefined> = {
    haraguchi: process.env.SPREADSHEET_ID_HARAGUCHI ?? process.env.SPREADSHEET_ID,
    okamiya:   process.env.SPREADSHEET_ID_OKAMIYA,
    futagami:  process.env.SPREADSHEET_ID_FUTAGAMI,
  }
  const id = map[teacherId]
  if (!id) throw new Error(`Spreadsheet ID not configured for: ${teacherId}`)
  return id
}

function getAuth() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const json = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export async function getSheetsClient() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

// 「面談記録シート」から生徒名簿を取得（A列）
export async function getStudents(spreadsheetId: string): Promise<string[]> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  return rows.map(r => r[0]).filter(Boolean).filter((_: string, i: number) => i > 0)
}

// 「面談記録シート」に生徒を追加
export async function addStudent(spreadsheetId: string, name: string): Promise<void> {
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: '面談記録シート!A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[name, '', '']] },
  })
}

// 「面談記録シート」から生徒を削除（A列で検索）
export async function deleteStudent(spreadsheetId: string, name: string): Promise<void> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  const rowIndex = rows.findIndex(r => r[0] === name)
  if (rowIndex < 0) return

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `面談記録シート!A${rowIndex + 1}:D${rowIndex + 1}`,
  })
}

// 「面談記録シート」の面談済みチェック・日付を更新
export async function updateInterviewRecord(spreadsheetId: string, name: string, date: string): Promise<void> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  const rowIndex = rows.findIndex(r => r[0] === name)
  if (rowIndex < 0) return

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `面談記録シート!B${rowIndex + 1}:C${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['済', date]] },
  })
}

// セルの背景色がグレー系かどうか判定
function isGreyBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  const r = color.red ?? 1
  const g = color.green ?? 1
  const b = color.blue ?? 1
  if (r > 0.88 && g > 0.88 && b > 0.88) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min < 0.15
}

// セルの背景色が水色・シアン系かどうか判定（鶴瀬の追加枠）
function isCyanBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  // 省略されたチャンネルは 0 扱い（#03ffff のように red≈0 の場合 API が red を省略する）
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  if (r > 0.93 && g > 0.93 && b > 0.93) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 0.06) return false
  return g > r && b > r && Math.max(g, b) > 0.35
}

// セルの背景色が黄色系かどうか判定（岡宮のふじみ野枠）
function isYellowBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  // 省略されたチャンネルは 0 扱い（yellow=#FFFF00 は blue≈0 で API が blue を省略する場合がある）
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  if (r > 0.95 && g > 0.95 && b > 0.95) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 0.08) return false
  return r > 0.6 && g > 0.6 && b < r * 0.6 && b < g * 0.6
}

// 面談不可日の取得
export async function getBlockedDates(spreadsheetId: string): Promise<string[]> {
  try {
    const sheets = await getSheetsClient()
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: ['2026!A:A'],
      includeGridData: true,
    })
    const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData || []
    const blocked: string[] = []
    let currentMonth = 0

    rowData.forEach((row, i) => {
      if (i === 0) return
      const cell = row.values?.[0]
      if (!cell) return
      const cellValue = (cell.formattedValue || '').trim()
      if (!cellValue) return

      if (cellValue.includes('/')) {
        const [m] = cellValue.split('/').map(Number)
        currentMonth = m
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!isGreyBackground(cell.effectiveFormat?.backgroundColor as any)) return

      if (cellValue.includes('/')) {
        blocked.push(cellValue)
      } else {
        const d = Number(cellValue)
        if (!isNaN(d) && currentMonth > 0) {
          blocked.push(`${currentMonth}/${d}`)
        }
      }
    })

    return blocked
  } catch {
    return []
  }
}

// 「2026」シートの予約状況を取得
export async function getBookings(spreadsheetId: string): Promise<{
  date: string
  dayOfWeek: string
  slots: Record<string, string>
}[]> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '2026!A:AM',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []

  const headers = rows[0]
  const result = []
  let currentMonth = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const rawDate = row[0].toString().trim()

    let dateStr = rawDate
    if (rawDate.includes('/')) {
      const [m] = rawDate.split('/').map(Number)
      currentMonth = m
    } else {
      const d = Number(rawDate)
      if (!isNaN(d) && currentMonth > 0) dateStr = `${currentMonth}/${d}`
    }

    const slots: Record<string, string> = {}
    for (let j = 2; j < headers.length; j++) {
      const timeHeader = headers[j]
      if (timeHeader && row[j]) slots[timeHeader] = row[j]
    }
    result.push({ date: dateStr, dayOfWeek: row[1] || '', slots })
  }
  return result
}

// 名前で予約を検索
export async function findBookingsByName(spreadsheetId: string, name: string): Promise<{
  date: string
  dayOfWeek: string
  slot: string
  type: string
}[]> {
  const bookings = await getBookings(spreadsheetId)
  const results: { date: string; dayOfWeek: string; slot: string; type: string }[] = []

  for (const { date, dayOfWeek, slots } of bookings) {
    for (const [slot, cellValue] of Object.entries(slots)) {
      const m = cellValue.match(/^(.+?)（(.+?)）/)
      if (m && m[1] === name) {
        results.push({ date, dayOfWeek, slot, type: m[2] })
      }
    }
  }

  results.sort((a, b) => {
    const [am, ad] = a.date.split('/').map(Number)
    const [bm, bd] = b.date.split('/').map(Number)
    const dc = (am * 100 + ad) - (bm * 100 + bd)
    return dc !== 0 ? dc : a.slot.localeCompare(b.slot)
  })

  return results
}

// 予約可能時間枠の定義
export const BOOKABLE_SLOTS = [
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '22:15'
]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function getSlotStatusForDate(
  spreadsheetId: string,
  dateStr: string,
  excludeSlot?: string,
  schoolId?: string
): Promise<{ slot: string; booked: string | null }[]> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap(spreadsheetId)
  const rowIndex = await findDateRow(spreadsheetId, dateStr)

  if (rowIndex < 0) {
    return BOOKABLE_SLOTS.map(slot => ({ slot, booked: null }))
  }

  const lastCol = colIndexToLetter(Object.keys(colMap).length + 2)
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`2026!A${rowIndex + 1}:${lastCol}${rowIndex + 1}`],
    includeGridData: true,
  })
  const cells = res.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCellValue = (colIdx: number): string => (cells[colIdx] as any)?.formattedValue || ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellGrey = (colIdx: number): boolean => isGreyBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellCyan = (colIdx: number): boolean => isCyanBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellYellow = (colIdx: number): boolean => isYellowBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // このschoolから見て「別の学校専用セル」かどうか
  // 鶴瀬から見る場合: 黄色=ふじみ野専用 → 無視
  // ふじみ野から見る場合: 水色=鶴瀬専用 → 無視
  const isOtherSchoolCell = (colIdx: number): boolean => {
    if (schoolId === 'tsuruse') return isCellYellow(colIdx)
    if (schoolId === 'fujimino') return isCellCyan(colIdx)
    return false
  }

  const isExtraSlotCell = (colIdx: number): boolean => {
    if (schoolId === 'fujimino') return isCellYellow(colIdx)
    return isCellCyan(colIdx)
  }

  // 別の学校のセルは occupied 計算から除外する（時間ブロックに影響させない）
  const occupied: { mins: number; buffer: number }[] = []
  Object.entries(colMap).forEach(([header, colIdx]) => {
    if (!header.includes(':')) return
    if (header === excludeSlot) return
    const idx = colIdx as number
    const val = getCellValue(idx)
    if (!val) return
    if (isCellGrey(idx)) return
    if (isOtherSchoolCell(idx)) return
    const isAppBooking = /（(2者面談|3者面談)）/.test(val)
    occupied.push({ mins: timeToMinutes(header), buffer: isAppBooking ? 30 : 45 })
  })

  const extraSlots: string[] = []
  Object.entries(colMap).forEach(([header, colIdx]) => {
    if (!header.includes(':')) return
    const idx = colIdx as number
    if (getCellValue(idx)) return
    if (!isExtraSlotCell(idx)) return
    if (!BOOKABLE_SLOTS.includes(header)) extraSlots.push(header)
  })

  const allSlots = [...BOOKABLE_SLOTS, ...extraSlots]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

  return allSlots.map(slot => {
    const colIdx = colMap[slot]
    const cellValue = colIdx !== undefined ? getCellValue(colIdx) : ''

    if (cellValue) {
      // 別の学校の予約は「存在しない」として空き扱い
      if (colIdx !== undefined && isOtherSchoolCell(colIdx)) return { slot, booked: null }
      return { slot, booked: cellValue }
    }

    if (colIdx !== undefined && isCellGrey(colIdx)) {
      return { slot, booked: '__blocked__' }
    }

    // 空セルでも他校専用セルはブロック（例: 鶴瀬から見た黄色セル＝ふじみ野専用）
    if (colIdx !== undefined && isOtherSchoolCell(colIdx)) {
      return { slot, booked: '__blocked__' }
    }

    const slotMins = timeToMinutes(slot)

    const conflictsAhead = occupied.some(({ mins: t }) => slotMins < t && t < slotMins + 30)
    if (conflictsAhead) return { slot, booked: '__blocked__' }

    const isBlocked = occupied.some(({ mins: t, buffer }) => t <= slotMins && slotMins < t + buffer)
    if (isBlocked) return { slot, booked: '__blocked__' }

    return { slot, booked: null }
  })
}

async function getColumnMap(spreadsheetId: string): Promise<Record<string, number>> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '2026!1:1',
  })
  const headers = (res.data.values || [[]])[0]
  const map: Record<string, number> = {}
  headers.forEach((h: string, i: number) => {
    if (h) map[h] = i
  })
  return map
}

async function findDateRow(spreadsheetId: string, dateStr: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '2026!A:A',
  })
  const rows = res.data.values || []

  const [targetMonth, targetDay] = dateStr.split('/').map(Number)

  let currentMonth = 0
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? '').toString().trim()
    if (!cell) continue

    if (cell.includes('/')) {
      const [m, d] = cell.split('/').map(Number)
      currentMonth = m
      if (m === targetMonth && d === targetDay) return i
    } else {
      const d = Number(cell)
      if (!isNaN(d) && currentMonth === targetMonth && d === targetDay) return i
    }
  }
  return -1
}

function colIndexToLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

async function setCellBackground(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number,
  colIndex: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateCells: {
          rows: [{
            values: [{
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.4, blue: 0.4 },
              },
            }],
          }],
          fields: 'userEnteredFormat.backgroundColor',
          start: { sheetId, rowIndex, columnIndex: colIndex },
        },
      }],
    },
  })
}

async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.get({ spreadsheetId })
  const sheet = res.data.sheets?.find(s => s.properties?.title === sheetName)
  return sheet?.properties?.sheetId ?? 0
}

export async function writeBooking(
  spreadsheetId: string,
  dateStr: string,
  slot: string,
  studentName: string,
  meetingType: string,
  noteText?: string
): Promise<void> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap(spreadsheetId)
  const rowIndex = await findDateRow(spreadsheetId, dateStr)
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  const base = `${studentName}（${meetingType}）`
  const cellValue = noteText ? `${base}\n${noteText}` : base

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[cellValue]] },
  })

  const sheetId = await getSheetId(spreadsheetId, '2026')
  await setCellBackground(sheets, spreadsheetId, sheetId, rowIndex, colIndex)
}

async function clearCellBackground(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number,
  colIndex: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateCells: {
          rows: [{
            values: [{
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 },
              },
            }],
          }],
          fields: 'userEnteredFormat.backgroundColor',
          start: { sheetId, rowIndex, columnIndex: colIndex },
        },
      }],
    },
  })
}

export async function cancelBooking(spreadsheetId: string, dateStr: string, slot: string): Promise<void> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap(spreadsheetId)
  const rowIndex = await findDateRow(spreadsheetId, dateStr)
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['']] },
  })
  const sheetId = await getSheetId(spreadsheetId, '2026')
  await clearCellBackground(sheets, spreadsheetId, sheetId, rowIndex, colIndex)
}

export async function isSlotBooked(spreadsheetId: string, dateStr: string, slot: string): Promise<string | null> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap(spreadsheetId)
  const rowIndex = await findDateRow(spreadsheetId, dateStr)
  if (rowIndex < 0) return null

  const colIndex = colMap[slot]
  if (colIndex === undefined) return null

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
  })
  return ((res.data.values || [[]])[0] || [])[0] || null
}

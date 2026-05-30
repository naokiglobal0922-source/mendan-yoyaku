import { google } from 'googleapis'

const APP_BOOKING_RE = /（(２者面談（保護者のみ）|[２2]者面談|[３3]者面談（生徒本人も参加）|三者面談（生徒本人も参加）|電話面談)）/

const SCHOOL_SHORT: Record<string, string> = {
  tsuruse: '鶴瀬',
  fujimino: 'ふじみ野',
  kawagoe: '川越',
}

// セル値末尾の [校舎名] から schoolId を逆引き
const SCHOOL_LABEL_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(SCHOOL_SHORT).map(([id, label]) => [label, id])
)
function extractSchoolFromCellValue(val: string): string | undefined {
  const m = val.match(/\[(.+?)\]/)
  return m ? SCHOOL_LABEL_TO_ID[m[1]] : undefined
}

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
  try {
    const sheets = await getSheetsClient()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '面談記録シート!A:A',
    })
    const rows = res.data.values || []
    return rows.map(r => r[0]).filter(Boolean).filter((_: string, i: number) => i > 0)
  } catch {
    return []
  }
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

// セルの背景色が緑系かどうか判定（岡宮のどちらでも可枠）
function isGreenBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  if (r > 0.93 && g > 0.93 && b > 0.93) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 0.06) return false
  return g > r && g > b && g > 0.35
}

// セルの背景色がオレンジ系かどうか判定（二神の両校舎対応枠）
function isOrangeBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  if (r > 0.95 && g > 0.95 && b > 0.95) return false
  return r > 0.85 && g > 0.4 && g < 0.82 && b < 0.3 && r > g
}

// セルの背景色が青系かどうか判定（原口の追加枠）
function isBlueBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  if (r > 0.93 && g > 0.93 && b > 0.93) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 0.06) return false
  return b > r && b > g && b > 0.3
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
    const [res, sheetInfo] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId, ranges: ['2026!A:B'], includeGridData: true }),
      getSheetInfo(spreadsheetId),
    ])
    const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData || []
    const blocked: string[] = []
    let currentMonth = 0

    rowData.forEach((row, i) => {
      if (i === 0) return
      const cellA = row.values?.[0]
      const cellB = row.values?.[1]
      if (!cellA && !cellB) return

      const aVal = (cellA?.formattedValue || '').trim()
      const bVal = (cellB?.formattedValue || '').trim()

      if (sheetInfo.isFutagami) {
        if (aVal && !isNaN(Number(aVal)) && Number(aVal) > 0) currentMonth = Number(aVal)
        if (!bVal) return
        const d = Number(bVal)
        if (isNaN(d) || d <= 0 || currentMonth <= 0) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!isGreyBackground(cellA?.effectiveFormat?.backgroundColor as any)) return
        blocked.push(`${currentMonth}/${d}`)
      } else {
        if (!aVal) return
        if (aVal.includes('/')) {
          const [m] = aVal.split('/').map(Number)
          currentMonth = m
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!isGreyBackground(cellA?.effectiveFormat?.backgroundColor as any)) return
        if (aVal.includes('/')) {
          blocked.push(aVal)
        } else {
          const d = Number(aVal)
          if (!isNaN(d) && currentMonth > 0) blocked.push(`${currentMonth}/${d}`)
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
  const [sheetInfo, res] = await Promise.all([
    getSheetInfo(spreadsheetId),
    sheets.spreadsheets.values.get({ spreadsheetId, range: '2026' }),
  ])
  const rows = res.data.values || []
  if (rows.length === 0) return []

  const { colMap, isFutagami, dayOfWeekCol } = sheetInfo
  // colMap から時間列のみ抽出（ヘッダーが HH:MM 形式のもの）
  const timeSlotCols = Object.entries(colMap).filter(([h]) => /^\d{1,2}:\d{2}$/.test(h))

  const result = []
  let currentMonth = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    let dateStr = ''
    if (isFutagami) {
      const a = (row[0] ?? '').toString().trim()
      const b = (row[1] ?? '').toString().trim()
      if (!b) continue
      if (a && !isNaN(Number(a)) && Number(a) > 0) currentMonth = Number(a)
      if (!currentMonth) continue
      dateStr = `${currentMonth}/${b}`
    } else {
      if (!row[0]) continue
      const rawDate = row[0].toString().trim()
      if (rawDate.includes('/')) {
        const [m] = rawDate.split('/').map(Number)
        currentMonth = m
        dateStr = rawDate
      } else {
        const d = Number(rawDate)
        if (!isNaN(d) && currentMonth > 0) dateStr = `${currentMonth}/${d}`
        else continue
      }
    }

    const slots: Record<string, string> = {}
    for (const [header, colIdx] of timeSlotCols) {
      const val = row[colIdx]
      if (val) slots[header] = val as string
    }
    result.push({ date: dateStr, dayOfWeek: row[dayOfWeekCol] || '', slots })
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

  const normName = (s: string) => s.replace(/[\s　]/g, '')
  const normalizedTarget = normName(name)

  for (const { date, dayOfWeek, slots } of bookings) {
    for (const [slot, cellValue] of Object.entries(slots)) {
      // 全角・半角どちらの括弧でも名前を抽出
      const nameMatch = cellValue.match(/^(.+?)[（(]/)
      const typeMatch = APP_BOOKING_RE.exec(cellValue)
      if (nameMatch && normName(nameMatch[1]) === normalizedTarget) {
        results.push({ date, dayOfWeek, slot, type: typeMatch ? typeMatch[1] : '' })
      } else if (!nameMatch && normName(cellValue.trim()) === normalizedTarget) {
        // 括弧なし（名前のみ手動入力）
        results.push({ date, dayOfWeek, slot, type: '' })
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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function getSlotStatusForDate(
  spreadsheetId: string,
  dateStr: string,
  excludeSlot?: string,
  schoolId?: string,
  teacherId?: string,
  debug?: boolean
): Promise<{ slot: string; booked: string | null; _debug?: unknown }[]> {
  const sheets = await getSheetsClient()
  const [sheetInfo, rowIndex] = await Promise.all([
    getSheetInfo(spreadsheetId),
    findDateRow(spreadsheetId, dateStr),
  ])
  const { colMap, dayOfWeekCol } = sheetInfo

  if (rowIndex < 0) return []

  const lastCol = colIndexToLetter(Object.keys(colMap).length + 2)
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`2026!A${rowIndex + 1}:${lastCol}${rowIndex + 1}`],
    includeGridData: true,
  })
  const cells = res.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateCellBg = (cells[0] as any)?.effectiveFormat?.backgroundColor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayOfWeekCellBg = (cells[dayOfWeekCol] as any)?.effectiveFormat?.backgroundColor
  const isDayYellow = isYellowBackground(dateCellBg) || isYellowBackground(dayOfWeekCellBg)
  const isDayCyan = isCyanBackground(dateCellBg) || isCyanBackground(dayOfWeekCellBg)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCellValue = (colIdx: number): string => (cells[colIdx] as any)?.formattedValue || ''
  // 予約書き込み時に背景を赤に変えているため、メモから元の背景色を復元する
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCellOriginalBg = (colIdx: number): { red?: number; green?: number; blue?: number } | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noteStr: string = (cells[colIdx] as any)?.note ?? ''
      if (!noteStr) return null
      const parsed = JSON.parse(noteStr)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (parsed as any).bg ?? parsed
    } catch { return null }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellGrey = (colIdx: number): boolean => isGreyBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellCyan = (colIdx: number): boolean => isCyanBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellYellow = (colIdx: number): boolean => isYellowBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellGreen = (colIdx: number): boolean => isGreenBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellOrange = (colIdx: number): boolean => isOrangeBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCellBlue = (colIdx: number): boolean => isBlueBackground((cells[colIdx] as any)?.effectiveFormat?.backgroundColor)

  const isOtherSchoolCell = (colIdx: number): boolean => {
    if (teacherId === 'futagami') {
      // オレンジ=両校舎 → どちらからでも予約可
      if (isCellOrange(colIdx)) return false
      // 水色=ふじみ野のみ、緑=川越のみ
      if (schoolId === 'fujimino') return isCellGreen(colIdx)
      if (schoolId === 'kawagoe') return isCellCyan(colIdx)
      return false
    }
    if (isCellGreen(colIdx)) return false       // 緑はどちらの校舎でも予約可（岡宮）
    if (schoolId === 'tsuruse') return isCellYellow(colIdx)
    if (schoolId === 'fujimino') return isCellCyan(colIdx)
    return false
  }

  // スプレッドシートの全時間列を取得（デフォルトリストなし）
  const allSlots = Object.keys(colMap)
    .filter(h => /^\d{1,2}:\d{2}$/.test(h))
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

  // 予約済み一覧（バッファ計算用）
  const occupied: { mins: number; buffer: number }[] = []
  allSlots.forEach(header => {
    if (header === excludeSlot) return
    const idx = colMap[header]
    const val = getCellValue(idx)
    if (!val) return
    if (isCellGrey(idx)) return
    const isAppBooking = APP_BOOKING_RE.test(val)

    if (isAppBooking && (teacherId === 'futagami' || teacherId === 'okamiya')) {
      // 予約済みセルは背景が赤になっているため、メモから元の背景色を復元して校舎判定
      const origBg = getCellOriginalBg(idx)
      const origOrange = origBg ? isOrangeBackground(origBg) : false
      const origGreen  = origBg ? isGreenBackground(origBg)  : false
      const origCyan   = origBg ? isCyanBackground(origBg)   : false
      const origYellow = origBg ? isYellowBackground(origBg) : false

      // 両校舎セル（二神オレンジ / 岡宮緑）
      const origBothSchools =
        (teacherId === 'futagami' && origOrange) ||
        (teacherId === 'okamiya'  && origGreen)

      // 他校専用セル
      const origOtherSchool = teacherId === 'futagami'
        ? (!origOrange && (schoolId === 'fujimino' ? origGreen : schoolId === 'kawagoe' ? origCyan : false))
        : (!origGreen  && (schoolId === 'tsuruse'  ? origYellow : schoolId === 'fujimino' ? origCyan : false))

      if (origOtherSchool) {
        occupied.push({ mins: timeToMinutes(header), buffer: 60 })
        return
      }
      if (origBothSchools) {
        const bookingSchool = extractSchoolFromCellValue(val)
        occupied.push({ mins: timeToMinutes(header), buffer: bookingSchool === schoolId ? 30 : 60 })
        return
      }
      // 同校舎セル or 元色不明（origBg=null）→ セル値の校舎ラベルで判定、なければ保守的に60分
      const bookingSchool = extractSchoolFromCellValue(val)
      occupied.push({ mins: timeToMinutes(header), buffer: bookingSchool === schoolId ? 30 : 60 })
      return
    }

    // futagami/okamiya 以外、または手動入力
    if (isOtherSchoolCell(idx) && isAppBooking) return  // 他校アプリ予約は除外
    occupied.push({ mins: timeToMinutes(header), buffer: 30 })
  })

  return allSlots.map(slot => {
    const colIdx = colMap[slot]
    const cellValue = colIdx !== undefined ? getCellValue(colIdx) : ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debugInfo = debug ? { colIdx, cellValue, bg: colIdx !== undefined ? (cells[colIdx] as any)?.effectiveFormat?.backgroundColor : null, isYellow: colIdx !== undefined ? isCellYellow(colIdx) : false, isDayYellow, schoolId } : undefined

    // 予約済み
    if (cellValue) {
      if (colIdx !== undefined && isOtherSchoolCell(colIdx)) {
        // 他校のアプリ予約は非表示（空き扱い）、手動入力は全校からブロック
        const isAppBooking = APP_BOOKING_RE.test(cellValue)
        if (isAppBooking) return { slot, booked: null, _debug: debugInfo }
        return { slot, booked: '__blocked__', _debug: debugInfo }
      }
      // 自校のセル: アプリ予約・手動入力ともにそのまま返す（キャンセル可）
      return { slot, booked: cellValue, _debug: debugInfo }
    }

    if (colIdx !== undefined && isCellGrey(colIdx)) {
      return { slot, booked: '__blocked__', _debug: debugInfo }
    }

    if (colIdx !== undefined && isOtherSchoolCell(colIdx)) {
      return { slot, booked: '__blocked__', _debug: debugInfo }
    }

    if (schoolId === 'tsuruse' && isDayYellow) return { slot, booked: '__blocked__', _debug: debugInfo }
    if (schoolId === 'fujimino' && isDayCyan) return { slot, booked: '__blocked__', _debug: debugInfo }

    // 岡宮: 黄・水色・緑のいずれかのみ予約可（それ以外はすべて面談不可）
    if (teacherId === 'okamiya') {
      if (colIdx === undefined) return { slot, booked: '__blocked__', _debug: debugInfo }
      const isAvailableColor = isCellYellow(colIdx) || isCellCyan(colIdx) || isCellGreen(colIdx)
      if (!isAvailableColor) return { slot, booked: '__blocked__', _debug: debugInfo }
    }

    // 原口: 水色または青のみ予約可
    if (teacherId === 'haraguchi') {
      if (colIdx === undefined) return { slot, booked: '__blocked__', _debug: debugInfo }
      if (!isCellCyan(colIdx) && !isCellBlue(colIdx)) return { slot, booked: '__blocked__', _debug: debugInfo }
    }

    // 二神: 校舎に応じた色のみ予約可（青=ふじみ野、緑=川越、オレンジ=両方）
    if (teacherId === 'futagami') {
      if (colIdx === undefined) return { slot, booked: '__blocked__', _debug: debugInfo }
      const orange = isCellOrange(colIdx)
      if (schoolId === 'fujimino' && !isCellCyan(colIdx) && !orange) return { slot, booked: '__blocked__', _debug: debugInfo }
      if (schoolId === 'kawagoe' && !isCellGreen(colIdx) && !orange) return { slot, booked: '__blocked__', _debug: debugInfo }
    }

    const slotMins = timeToMinutes(slot)

    const conflictsAhead = occupied.some(({ mins: t, buffer }) => slotMins < t && t < slotMins + buffer)
    if (conflictsAhead) return { slot, booked: '__blocked__', _debug: debugInfo }

    const isBlocked = occupied.some(({ mins: t, buffer }) => t <= slotMins && slotMins < t + buffer)
    if (isBlocked) return { slot, booked: '__blocked__', _debug: debugInfo }

    return { slot, booked: null, _debug: debugInfo }
  })
}

interface SheetInfo {
  colMap: Record<string, number>
  dayOfWeekCol: number  // column index for weekday (1 = standard, 2 = futagami)
  isFutagami: boolean
}

async function getSheetInfo(spreadsheetId: string): Promise<SheetInfo> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '2026!1:1',
  })
  const headers = (res.data.values || [[]])[0]

  // Futagami format: header[1] is "2026" (year), so time slots start at col D (index 3)
  const isFutagami = /^\d{4}$/.test((headers[1] || '').toString().trim())

  const colMap: Record<string, number> = {}
  headers.forEach((h: string, i: number) => {
    if (h) colMap[h] = i
  })

  return { colMap, dayOfWeekCol: isFutagami ? 2 : 1, isFutagami }
}

// Keep backward-compat wrapper
async function getColumnMap(spreadsheetId: string): Promise<Record<string, number>> {
  return (await getSheetInfo(spreadsheetId)).colMap
}

async function findDateRow(spreadsheetId: string, dateStr: string): Promise<number> {
  const sheets = await getSheetsClient()
  const [targetMonth, targetDay] = dateStr.split('/').map(Number)

  // Read A:B to support futagami format (month in A, day in B)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '2026!A:B',
  })
  const rows = res.data.values || []

  // Detect format: futagami has a numeric value in col B of data rows
  let isFutagami = false
  for (let i = 1; i < rows.length; i++) {
    const b = (rows[i]?.[1] ?? '').toString().trim()
    if (b !== '') {
      isFutagami = !isNaN(Number(b)) && Number(b) > 0
      break
    }
  }

  let currentMonth = 0
  for (let i = 0; i < rows.length; i++) {
    const a = (rows[i]?.[0] ?? '').toString().trim()
    const b = (rows[i]?.[1] ?? '').toString().trim()

    if (isFutagami) {
      if (a && !isNaN(Number(a)) && Number(a) > 0) currentMonth = Number(a)
      const d = Number(b)
      if (!isNaN(d) && d > 0 && currentMonth === targetMonth && d === targetDay) return i
    } else {
      if (!a) continue
      if (a.includes('/')) {
        const [m, d] = a.split('/').map(Number)
        currentMonth = m
        if (m === targetMonth && d === targetDay) return i
      } else {
        const d = Number(a)
        if (!isNaN(d) && currentMonth === targetMonth && d === targetDay) return i
      }
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

type RgbColor = { red?: number; green?: number; blue?: number }

async function getSheet2026Id(spreadsheetId: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.get({ spreadsheetId })
  const sheet = res.data.sheets?.find(s => s.properties?.title === '2026')
  return sheet?.properties?.sheetId ?? 0
}

async function updateCellColorAndNote(
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number,
  colIndex: number,
  bgColor: RgbColor | null,
  note: string
): Promise<void> {
  const sheets = await getSheetsClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cellData: Record<string, any> = { note }
  const fields: string[] = ['note']
  if (bgColor !== null) {
    cellData.userEnteredFormat = { backgroundColor: bgColor }
    fields.push('userEnteredFormat.backgroundColor')
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateCells: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          rows: [{ values: [cellData] }],
          fields: fields.join(','),
        }
      }]
    }
  })
}

const BOOKED_COLOR: RgbColor = { red: 0.918, green: 0.4, blue: 0.4 }

export async function writeBooking(
  spreadsheetId: string,
  dateStr: string,
  slot: string,
  studentName: string,
  meetingType: string,
  schoolId?: string
): Promise<void> {
  const sheets = await getSheetsClient()
  const [colMap, rowIndex] = await Promise.all([
    getColumnMap(spreadsheetId),
    findDateRow(spreadsheetId, dateStr),
  ])
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  // 元の背景色を読み取り
  const cellRange = `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`
  const [cellRes, sheetId] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, ranges: [cellRange], includeGridData: true }),
    getSheet2026Id(spreadsheetId),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalBg: RgbColor = (cellRes.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] as any)?.effectiveFormat?.backgroundColor ?? {}

  const schoolLabel = schoolId ? SCHOOL_SHORT[schoolId] : null
  const cellValue = schoolLabel
    ? `${studentName}（${meetingType}）[${schoolLabel}]`
    : `${studentName}（${meetingType}）`

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[cellValue]] },
  })

  // 元の背景色と校舎IDをメモに保存し、赤背景を設定
  const noteContent = schoolId
    ? JSON.stringify({ bg: originalBg, school: schoolId })
    : JSON.stringify(originalBg)
  await updateCellColorAndNote(spreadsheetId, sheetId, rowIndex, colIndex, BOOKED_COLOR, noteContent)
}


export async function cancelBooking(spreadsheetId: string, dateStr: string, slot: string): Promise<void> {
  const sheets = await getSheetsClient()
  const [colMap, rowIndex] = await Promise.all([
    getColumnMap(spreadsheetId),
    findDateRow(spreadsheetId, dateStr),
  ])
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  const cellRange = `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`
  const [cellRes, sheetId] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, ranges: [cellRange], includeGridData: true }),
    getSheet2026Id(spreadsheetId),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cellNote: string = (cellRes.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] as any)?.note ?? ''
  let restoreBg: RgbColor | null = null
  try {
    if (cellNote) {
      const parsed = JSON.parse(cellNote)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      restoreBg = (parsed as any).bg ?? parsed  // 新形式: {bg, school} / 旧形式: RgbColor直接
    }
  } catch { /* ignore */ }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['']] },
  })

  // 元の背景色に戻し、メモを削除（元色がない場合は背景は変更しない）
  await updateCellColorAndNote(spreadsheetId, sheetId, rowIndex, colIndex, restoreBg, '')
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

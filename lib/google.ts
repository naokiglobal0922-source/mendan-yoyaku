import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!

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
export async function getStudents(): Promise<string[]> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  return rows.map(r => r[0]).filter(Boolean).filter((_: string, i: number) => i > 0) // skip header
}

// 「面談記録シート」に生徒を追加
export async function addStudent(name: string): Promise<void> {
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: '面談記録シート!A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[name, '', '']] },
  })
}

// 「面談記録シート」から生徒を削除（A列で検索）
export async function deleteStudent(name: string): Promise<void> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  const rowIndex = rows.findIndex(r => r[0] === name)
  if (rowIndex < 0) return

  // 行をクリア（削除の代わりにクリア）
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `面談記録シート!A${rowIndex + 1}:D${rowIndex + 1}`,
  })
}

// 「面談記録シート」の面談済みチェック・日付を更新
export async function updateInterviewRecord(name: string, date: string): Promise<void> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '面談記録シート!A:A',
  })
  const rows = res.data.values || []
  const rowIndex = rows.findIndex(r => r[0] === name)
  if (rowIndex < 0) return

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
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

// セルの背景色が蛍光水色（シアン系）かどうか判定 → 追加可能枠の印
function isCyanBackground(color?: { red?: number; green?: number; blue?: number } | null): boolean {
  if (!color) return false
  const r = color.red ?? 1
  const g = color.green ?? 1
  const b = color.blue ?? 1
  if (r > 0.88 && g > 0.88 && b > 0.88) return false
  // 青・緑が高く、赤が低い（シアン系）
  return b >= 0.6 && g >= 0.6 && r <= 0.7 && (g - r > 0.15 || b - r > 0.15)
}

// 面談不可日の取得：「2026」シートのA列でグレー背景のセルを不可日として検出
export async function getBlockedDates(): Promise<string[]> {
  try {
    const sheets = await getSheetsClient()
    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ['2026!A:A'],
      includeGridData: true,
    })
    const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData || []
    const blocked: string[] = []
    let currentMonth = 0

    rowData.forEach((row, i) => {
      if (i === 0) return // ヘッダー行スキップ
      const cell = row.values?.[0]
      if (!cell) return
      const cellValue = (cell.formattedValue || '').trim()
      if (!cellValue) return

      // 月を追跡（"4/1" 形式の行で更新）
      if (cellValue.includes('/')) {
        const [m] = cellValue.split('/').map(Number)
        currentMonth = m
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!isGreyBackground(cell.effectiveFormat?.backgroundColor as any)) return

      // グレーなら不可日として追加
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

// 「2026」シートの予約状況を取得（月コンテキストを追跡して完全日付を返す）
export async function getBookings(): Promise<{
  date: string
  dayOfWeek: string
  slots: Record<string, string>
}[]> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
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

// 名前で予約を検索（保護者向け確認用）
export async function findBookingsByName(name: string): Promise<{
  date: string
  dayOfWeek: string
  slot: string
  type: string
}[]> {
  const bookings = await getBookings()
  const results: { date: string; dayOfWeek: string; slot: string; type: string }[] = []

  for (const { date, dayOfWeek, slots } of bookings) {
    for (const [slot, cellValue] of Object.entries(slots)) {
      const m = cellValue.match(/^(.+?)（(.+?)）$/)
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

// 1回のフェッチで日付行全体を読み、予約状況＋バッファ＋グレーセルブロックを返す
// excludeSlot: 予約変更時に変更元スロットのバッファを除外する
export async function getSlotStatusForDate(
  dateStr: string,
  excludeSlot?: string
): Promise<{ slot: string; booked: string | null }[]> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)

  if (rowIndex < 0) {
    return BOOKABLE_SLOTS.map(slot => ({ slot, booked: null }))
  }

  // 値＋書式を一括取得
  const lastCol = colIndexToLetter(Object.keys(colMap).length + 2)
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
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

  // テキストありセルのバッファ計算（グレーセルは除外、変更元スロットも除外）
  const occupied: { mins: number; buffer: number }[] = []
  Object.entries(colMap).forEach(([header, colIdx]) => {
    if (!header.includes(':')) return
    if (header === excludeSlot) return // 変更元スロットのバッファは無視
    const idx = colIdx as number
    const val = getCellValue(idx)
    if (!val) return
    if (isCellGrey(idx)) return
    const isAppBooking = /（(2者面談|3者面談)）/.test(val)
    occupied.push({ mins: timeToMinutes(header), buffer: isAppBooking ? 30 : 45 })
  })

  // シアン背景＋テキストなしの列から追加スロットを検出（15分刻み：1列＝1スロット）
  const extraSlots: string[] = []
  Object.entries(colMap).forEach(([header, colIdx]) => {
    if (!header.includes(':')) return
    const idx = colIdx as number
    if (getCellValue(idx)) return
    if (!isCellCyan(idx)) return
    if (!BOOKABLE_SLOTS.includes(header)) extraSlots.push(header)
  })

  const allSlots = [...BOOKABLE_SLOTS, ...extraSlots]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

  return allSlots.map(slot => {
    const colIdx = colMap[slot]
    const cellValue = colIdx !== undefined ? getCellValue(colIdx) : ''

    // 1. 予約あり（変更元スロット自身はそのまま booked として返す）
    if (cellValue) return { slot, booked: cellValue }

    // 2. セルそのものがグレー → 直接ブロック
    if (colIdx !== undefined && isCellGrey(colIdx)) {
      return { slot, booked: '__blocked__' }
    }

    const slotMins = timeToMinutes(slot)

    // 3. 後方バッファチェック（この枠から始まる予定が次のエントリーに被る場合も不可）
    //    例: 15:30に予定があれば 15:15 は不可（15:15+30分=15:45 > 15:30）
    const conflictsAhead = occupied.some(({ mins: t }) => slotMins < t && t < slotMins + 30)
    if (conflictsAhead) return { slot, booked: '__blocked__' }

    // 4. 前方バッファチェック（面談予約=30分、外部予定=45分）
    const isBlocked = occupied.some(({ mins: t, buffer }) => t <= slotMins && slotMins < t + buffer)
    if (isBlocked) return { slot, booked: '__blocked__' }

    return { slot, booked: null }
  })
}

// 「2026」シートのヘッダー行を読み取り、列インデックスマップを作成
async function getColumnMap(): Promise<Record<string, number>> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026!1:1',
  })
  const headers = (res.data.values || [[]])[0]
  const map: Record<string, number> = {}
  headers.forEach((h: string, i: number) => {
    if (h) map[h] = i
  })
  return map
}

// 日付文字列から行インデックスを探す（A列）
// スプシのA列は "4/1" → "2" → "3"... と月初だけ "月/日"、以降は日だけになっている
async function findDateRow(dateStr: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026!A:A',
  })
  const rows = res.data.values || []

  // dateStr は "5/12" 形式
  const [targetMonth, targetDay] = dateStr.split('/').map(Number)

  let currentMonth = 0
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? '').toString().trim()
    if (!cell) continue

    if (cell.includes('/')) {
      // "4/1" 形式 → 月を更新
      const [m, d] = cell.split('/').map(Number)
      currentMonth = m
      if (m === targetMonth && d === targetDay) return i
    } else {
      // "2" "3"... 形式 → 現在の月で判定
      const d = Number(cell)
      if (!isNaN(d) && currentMonth === targetMonth && d === targetDay) return i
    }
  }
  return -1
}

// 列番号をA1記法に変換
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

// 予約を書き込む

// セルに赤背景を設定する
async function setCellBackground(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  sheetId: number,
  rowIndex: number,
  colIndex: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
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

// シートIDを取得
async function getSheetId(sheetName: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = res.data.sheets?.find(s => s.properties?.title === sheetName)
  return sheet?.properties?.sheetId ?? 0
}

export async function writeBooking(
  dateStr: string,
  slot: string,
  studentName: string,
  meetingType: string
): Promise<void> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[`${studentName}（${meetingType}）`]] },
  })

  const sheetId = await getSheetId('2026')
  await setCellBackground(sheets, sheetId, rowIndex, colIndex)
}

// セル背景を白（デフォルト）にリセット
async function clearCellBackground(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  sheetId: number,
  rowIndex: number,
  colIndex: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
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

// 予約をキャンセル（セルを空にして背景リセット）
export async function cancelBooking(dateStr: string, slot: string): Promise<void> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const colIndex = colMap[slot]
  if (colIndex === undefined) throw new Error(`列 ${slot} が見つかりません`)

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['']] },
  })
  const sheetId = await getSheetId('2026')
  await clearCellBackground(sheets, sheetId, rowIndex, colIndex)
}

// 特定の日付・時間枠の予約状況を確認
export async function isSlotBooked(dateStr: string, slot: string): Promise<string | null> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)
  if (rowIndex < 0) return null

  const colIndex = colMap[slot]
  if (colIndex === undefined) return null

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`,
  })
  return ((res.data.values || [[]])[0] || [])[0] || null
}

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

// 「2026」シートの予約状況を取得
export async function getBookings(): Promise<{
  date: string
  dayOfWeek: string
  slots: Record<string, string>
}[]> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026!A:Z',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []

  const headers = rows[0] // A=日付, B=曜日, C以降=時間帯
  const result = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const slots: Record<string, string> = {}
    for (let j = 2; j < headers.length; j++) {
      const timeHeader = headers[j]
      if (timeHeader && row[j]) {
        slots[timeHeader] = row[j]
      }
    }
    result.push({
      date: row[0],
      dayOfWeek: row[1] || '',
      slots,
    })
  }
  return result
}

// 予約可能時間枠の定義
export const BOOKABLE_SLOTS = [
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '22:15'
]

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
async function findDateRow(dateStr: string): Promise<number> {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026!A:A',
  })
  const rows = res.data.values || []
  return rows.findIndex(r => r[0] === dateStr)
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
// スプシのC列以降が30分刻みのため、15分刻み枠は以下のルールで管理:
// 15:00 → "15:00"ヘッダーの列（上半分）
// 15:15 → "15:00"ヘッダーの列に "15:15:{name}" として追記（セミコロン区切り）
// 15:30 → "15:30"ヘッダーの列
// 15:45 → "15:30"ヘッダーの列に "15:45:{name}" として追記
// 16:00 → "16:00"ヘッダーの列
// 16:15 → "16:00"ヘッダーの列に "16:15:{name}" として追記
// 16:30 → "16:30"ヘッダーの列
// 22:15 → "22:00"ヘッダーの列に "22:15:{name}" として追記
function getSheetSlotKey(slot: string): { headerKey: string; isHalf: boolean } {
  const halfSlotMap: Record<string, string> = {
    '15:15': '15:00',
    '15:45': '15:30',
    '16:15': '16:00',
    '22:15': '22:00',
  }
  if (halfSlotMap[slot]) {
    return { headerKey: halfSlotMap[slot], isHalf: true }
  }
  return { headerKey: slot, isHalf: false }
}

export async function writeBooking(
  dateStr: string,
  slot: string,
  studentName: string
): Promise<void> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)
  if (rowIndex < 0) throw new Error(`日付 ${dateStr} が見つかりません`)

  const { headerKey, isHalf } = getSheetSlotKey(slot)
  const colIndex = colMap[headerKey]
  if (colIndex === undefined) throw new Error(`列 ${headerKey} が見つかりません`)

  const cellRef = `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`

  if (isHalf) {
    // 既存値を取得して追記
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: cellRef,
    })
    const current = ((existing.data.values || [[]])[0] || [])[0] || ''
    const newVal = current ? `${current} / ${slot}:${studentName}` : `${slot}:${studentName}`
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellRef,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newVal]] },
    })
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellRef,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[studentName]] },
    })
  }
}

// 特定の日付・時間枠の予約状況を確認
export async function isSlotBooked(dateStr: string, slot: string): Promise<string | null> {
  const sheets = await getSheetsClient()
  const colMap = await getColumnMap()
  const rowIndex = await findDateRow(dateStr)
  if (rowIndex < 0) return null

  const { headerKey, isHalf } = getSheetSlotKey(slot)
  const colIndex = colMap[headerKey]
  if (colIndex === undefined) return null

  const cellRef = `2026!${colIndexToLetter(colIndex)}${rowIndex + 1}`
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: cellRef,
  })
  const val = ((res.data.values || [[]])[0] || [])[0] || ''
  if (!val) return null

  if (isHalf) {
    // "slot:name" 形式を確認
    if (val.includes(`${slot}:`)) {
      const part = val.split(' / ').find((p: string) => p.startsWith(`${slot}:`))
      return part ? part.replace(`${slot}:`, '') : null
    }
    return null
  }
  return val || null
}

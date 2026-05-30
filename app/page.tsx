"use client"

import { useState, useCallback, useEffect } from 'react'
import { SCHOOLS, TEACHERS, getTeachersBySchool, type SchoolId } from '@/lib/teachers'

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const MEETING_TYPES: Record<string, string[]> = {
  default: ['２者面談（保護者のみ）', '３者面談（生徒本人も参加）'],
  futagami: ['２者面談（保護者のみ）', '３者面談（生徒本人も参加）', '電話面談'],
}
// スプレッドシートの既存表記との後方互換を含む判定用正規表現
const APP_BOOKING_RE = /（(２者面談（保護者のみ）|[２2]者面談|[３3]者面談（生徒本人も参加）|三者面談（生徒本人も参加）|電話面談)）/

const TOPICS = [
  '成績・学力のこと',
  '志望校・大学の選び方',
  '受験勉強の進め方',
  'モチベーション・やる気がないように見える',
  '学習習慣が身についていない',
  '部活と勉強の両立',
  '学校生活・友人関係',
  '模試の結果・偏差値について',
  '塾の授業・カリキュラムについて',
  '各講習について',
]

function getWeekDates(baseDate: Date, startDay: number = 1): Date[] {
  const week: Date[] = []
  const day = baseDate.getDay()
  const diff = (day - startDay + 7) % 7
  const firstDay = new Date(baseDate)
  firstDay.setDate(baseDate.getDate() - diff)
  for (let i = 0; i < 6; i++) {
    const d = new Date(firstDay)
    d.setDate(firstDay.getDate() + i)
    week.push(d)
  }
  return week
}

function formatDateForSheet(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateDisplay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日(${DAYS_JP[date.getDay()]})`
}

interface SlotStatus {
  slot: string
  booked: string | null
}

const normalizeName = (s: string) => s.replace(/[\s　]/g, '')

function extractName(cellValue: string): string {
  const m = cellValue.match(/^(.+?)（/)
  return m ? m[1] : cellValue
}
function extractType(cellValue: string): string {
  const m = cellValue.match(APP_BOOKING_RE)
  return m ? m[1] : MEETING_TYPES.default[0]
}
function extractTopicsFromCell(cellValue: string): string[] {
  const m = cellValue.match(/【話したいこと】([^\n]*)/)
  if (!m) return []
  return m[1].split('、').map(s => s.trim()).filter(Boolean)
}
function extractNoteFromCell(cellValue: string, key: string): string {
  const m = cellValue.match(new RegExp(`【${key}】([^\\n]*)`))
  return m ? m[1].trim() : ''
}
function extractRelationFromCell(cellValue: string): string {
  return extractNoteFromCell(cellValue, '本人との関係')
}

type FormMode = 'none' | 'new' | 'verify' | 'edit'

// ── 校舎選択画面 ──────────────────────────────────────
function SchoolSelect({ onSelect }: { onSelect: (id: SchoolId) => void }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <p className="text-[10px] font-medium tracking-[0.3em] text-gray-400 uppercase mb-0.5">Interview Reservation</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-serif-jp), serif' }}>
            EIMEI予備校面談予約システム
          </h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="text-sm font-semibold text-gray-600 mb-5">校舎を選択してください</p>
        <div className="space-y-3">
          {SCHOOLS.map(school => (
            <button
              key={school.id}
              onClick={() => onSelect(school.id)}
              className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-5 text-left shadow-sm hover:border-blue-300 hover:shadow-md active:scale-[0.99] transition-all"
            >
              <p className="text-base font-bold text-gray-900">{school.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {getTeachersBySchool(school.id).map(t => t.name).join('・')}
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

// ── 先生選択画面 ──────────────────────────────────────
function TeacherSelect({
  schoolId,
  onSelect,
  onBack,
}: {
  schoolId: SchoolId
  onSelect: (id: string) => void
  onBack: () => void
}) {
  const school = SCHOOLS.find(s => s.id === schoolId)!
  const teachers = getTeachersBySchool(schoolId)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-full px-3 py-1.5 mb-3 transition-all">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg>
            校舎選択に戻る
          </button>
          <p className="text-[10px] font-medium tracking-[0.3em] text-gray-400 uppercase mb-0.5">Interview Reservation</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-serif-jp), serif' }}>
            {school.name}
          </h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="text-sm font-semibold text-gray-600 mb-5">先生を選択してください</p>
        <div className="space-y-3">
          {teachers.map(teacher => (
            <button
              key={teacher.id}
              onClick={() => onSelect(teacher.id)}
              className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-5 text-left shadow-sm hover:border-blue-300 hover:shadow-md active:scale-[0.99] transition-all"
            >
              <p className="text-base font-bold text-gray-900">{teacher.name} 先生</p>
              <p className="text-xs text-gray-400 mt-1">
                {(teacher.schools as readonly SchoolId[]).map(sid => SCHOOLS.find(s => s.id === sid)?.name).join('・')}
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

// ── 予約メイン画面 ────────────────────────────────────
function BookingPage({
  teacherId,
  schoolId,
  teacherName,
  schoolName,
  weekStartDay,
  onBack,
}: {
  teacherId: string
  schoolId: string
  teacherName: string
  schoolName: string
  weekStartDay: number
  onBack: () => void
}) {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<SlotStatus[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [blockedDates, setBlockedDates] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/blocked-dates?teacher=${teacherId}`)
      .then(r => r.json())
      .then(d => setBlockedDates(d.dates || []))
  }, [teacherId])

  const [formMode, setFormMode] = useState<FormMode>('none')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [editingOldSlot, setEditingOldSlot] = useState<string | null>(null)
  const [verifyName, setVerifyName] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [studentName, setStudentName] = useState('')
  const [relation, setRelation] = useState('')
  const meetingTypes = MEETING_TYPES[teacherId] ?? MEETING_TYPES.default
  const [meetingType, setMeetingType] = useState(meetingTypes[0])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [chatNote, setChatNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [checkName, setCheckName] = useState('')
  const [checkResult, setCheckResult] = useState<{ date: string; dayOfWeek: string; slot: string; type: string }[] | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkActionResult, setCheckActionResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [checkCancelling, setCheckCancelling] = useState(false)

  const [hasSaturdaySlots, setHasSaturdaySlots] = useState(false)

  const baseDate = new Date(today)
  baseDate.setDate(today.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(baseDate, weekStartDay)


  const loadSlots = useCallback(async (date: Date, excludeSlot?: string, silent = false) => {
    if (!silent) { setLoadingSlots(true); setSlots([]) }
    const dateStr = formatDateForSheet(date)
    try {
      let url = `/api/bookings?date=${encodeURIComponent(dateStr)}&teacher=${teacherId}&school=${schoolId}`
      if (excludeSlot) url += `&excludeSlot=${encodeURIComponent(excludeSlot)}`
      const res = await fetch(url)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      if (!silent) setSlots([])
    } finally {
      if (!silent) setLoadingSlots(false)
    }
  }, [teacherId, schoolId])

  // 土曜日に空き枠があるか事前チェック
  useEffect(() => {
    const saturday = weekDates[5]
    const satStr = formatDateForSheet(saturday)
    setHasSaturdaySlots(false)
    fetch(`/api/bookings?date=${encodeURIComponent(satStr)}&teacher=${teacherId}&school=${schoolId}`)
      .then(r => r.json())
      .then(data => {
        const available = (data.slots as SlotStatus[] ?? []).some(s => s.booked === null)
        setHasSaturdaySlots(available && !blockedDates.includes(satStr))
      })
      .catch(() => {})
  }, [weekOffset, teacherId, schoolId, blockedDates])

  // 20秒ごとにサイレント再取得してリアルタイム反映
  useEffect(() => {
    if (!selectedDate) return
    const excludeSlot = formMode === 'edit' ? editingOldSlot ?? undefined : undefined
    const id = setInterval(() => loadSlots(selectedDate, excludeSlot, true), 20000)
    return () => clearInterval(id)
  }, [selectedDate, formMode, editingOldSlot, loadSlots])

  // ポーリング後、選択中の枠が埋まっていたらリセット
  useEffect(() => {
    if (formMode === 'new' && selectedSlot) {
      const s = slots.find(s => s.slot === selectedSlot)
      if (s && s.booked !== null) {
        setSelectedSlot(null)
        setResult({ ok: false, message: 'この時間枠は他の方が予約されました。別の時間をお選びください。' })
      }
    }
  }, [slots, formMode, selectedSlot])

  const resetForm = (skipReload = false) => {
    const wasEditing = editingOldSlot !== null
    setFormMode('none')
    setSelectedSlot(null)
    setEditingOldSlot(null)
    setVerifyName('')
    setVerifyError('')
    setStudentName('')
    setRelation('')
    setMeetingType(meetingTypes[0])
    setPhoneNumber('')
    setSelectedTopics([])
    setNote('')
    setChatNote('')
    setResult(null)
    if (!skipReload && wasEditing && selectedDate) loadSlots(selectedDate)
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    resetForm()
    loadSlots(date)
  }

  const toggleTopic = (t: string) =>
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const buildNoteText = () =>
    [
      relation ? `【本人との関係】${relation}` : '',
      meetingType === '電話面談' && phoneNumber ? `【電話番号】${phoneNumber}` : '',
      selectedTopics.length ? `【話したいこと】${selectedTopics.join('、')}` : '',
      note ? `【備考】${note}` : '',
      chatNote ? `【雑談】${chatNote}` : '',
    ].filter(Boolean).join('\n')

  const handleVerify = () => {
    const name = verifyName.trim()
    if (!name) { setVerifyError('名前を入力してください'); return }
    const found = slots.find(s =>
      s.booked && APP_BOOKING_RE.test(s.booked) && normalizeName(extractName(s.booked)) === normalizeName(name)
    )
    if (!found) {
      setVerifyError('その名前の予約が見つかりませんでした。フルネームで入力してください')
      return
    }
    const oldSlot = found.slot
    setEditingOldSlot(oldSlot)
    setSelectedSlot(oldSlot)
    setStudentName(extractName(found.booked!))
    setRelation(extractRelationFromCell(found.booked!))
    setMeetingType(extractType(found.booked!))
    setSelectedTopics(extractTopicsFromCell(found.booked!))
    setNote(extractNoteFromCell(found.booked!, '備考'))
    setChatNote(extractNoteFromCell(found.booked!, '雑談'))
    setVerifyError('')
    setFormMode('edit')
    if (selectedDate) loadSlots(selectedDate, oldSlot)
  }

  const handleSubmitNew = async () => {
    if (!selectedDate || !selectedSlot || !studentName) return
    setSubmitting(true); setResult(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          schoolId,
          date: formatDateForSheet(selectedDate),
          slot: selectedSlot,
          studentName,
          type: meetingType,
          note: buildNoteText(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: '予約が完了しました！' })
        resetForm(true)
        loadSlots(selectedDate)
      } else {
        setResult({ ok: false, message: data.error || '予約に失敗しました' })
      }
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  const handleSubmitEdit = async () => {
    if (!selectedDate || !selectedSlot || !editingOldSlot || !studentName) return
    setSubmitting(true); setResult(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          schoolId,
          date: formatDateForSheet(selectedDate),
          oldSlot: editingOldSlot,
          newSlot: selectedSlot,
          studentName,
          type: meetingType,
          note: buildNoteText(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: '予約を変更しました！' })
        resetForm(true)
        loadSlots(selectedDate)
      } else {
        setResult({ ok: false, message: data.error || '変更に失敗しました' })
      }
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  const handleCancelBooking = async () => {
    if (!selectedDate || !editingOldSlot) return
    if (!confirm('この予約をキャンセルしますか？')) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          schoolId,
          date: formatDateForSheet(selectedDate),
          slot: editingOldSlot,
          studentName,
        }),
      })
      if (res.ok) {
        setResult({ ok: true, message: '予約をキャンセルしました' })
        resetForm(true)
        loadSlots(selectedDate)
      } else {
        const data = await res.json()
        setResult({ ok: false, message: data.error || 'キャンセルに失敗しました' })
      }
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  const handleCheckBooking = async () => {
    const name = checkName.trim()
    if (!name) return
    setCheckLoading(true)
    setCheckResult(null)
    setCheckActionResult(null)
    try {
      const res = await fetch(`/api/bookings/lookup?name=${encodeURIComponent(name)}&teacher=${teacherId}`)
      const data = await res.json()
      setCheckResult(data.bookings || [])
    } catch {
      setCheckResult([])
    } finally {
      setCheckLoading(false)
    }
  }

  const handleCancelFromLookup = async (booking: { date: string; slot: string }) => {
    if (!confirm('この予約をキャンセルしますか？')) return
    setCheckCancelling(true)
    setCheckActionResult(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, schoolId, date: booking.date, slot: booking.slot, studentName: checkName.trim() }),
      })
      if (res.ok) {
        setCheckActionResult({ ok: true, message: '予約をキャンセルしました' })
        setCheckResult(null)
        setCheckName('')
        if (selectedDate && formatDateForSheet(selectedDate) === booking.date) loadSlots(selectedDate)
      } else {
        const data = await res.json()
        setCheckActionResult({ ok: false, message: data.error || 'キャンセルに失敗しました' })
      }
    } catch {
      setCheckActionResult({ ok: false, message: '通信エラーが発生しました' })
    } finally {
      setCheckCancelling(false)
    }
  }

  const handleChangeFromLookup = async (booking: { date: string; slot: string; type: string }) => {
    const [m, d] = booking.date.split('/').map(Number)
    const targetDate = new Date(today.getFullYear(), m - 1, d)
    const todayWeekStart = getWeekDates(new Date(today.getFullYear(), today.getMonth(), today.getDate()), weekStartDay)[0]
    const targetWeekStart = getWeekDates(targetDate, weekStartDay)[0]
    const newOffset = Math.round((targetWeekStart.getTime() - todayWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7))
    setWeekOffset(newOffset)
    setSelectedDate(targetDate)
    setEditingOldSlot(booking.slot)
    setSelectedSlot(booking.slot)
    setStudentName(checkName.trim())
    setMeetingType(booking.type)
    setSelectedTopics([])
    setNote('')
    setChatNote('')
    setRelation('')
    setFormMode('edit')
    setCheckResult(null)
    setCheckActionResult(null)
    await loadSlots(targetDate, booking.slot)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-full px-3 py-1.5 mb-3 transition-all">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg>
            先生を変更
          </button>
          <p className="text-[10px] font-medium tracking-[0.3em] text-gray-400 uppercase mb-0.5">Interview Reservation</p>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-serif-jp), serif' }}>
              {teacherName} 先生
            </h1>
            <span className="text-xs text-gray-400">{schoolName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 週ナビゲーション */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setWeekOffset(w => w - 1)} disabled={weekOffset <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
            <span className="text-sm font-semibold text-gray-700">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {hasSaturdaySlots ? weekDates[5].getDate() : weekDates[4].getDate()}日
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl">›</button>
          </div>
          <div className={`grid gap-2 ${hasSaturdaySlots ? 'grid-cols-6' : 'grid-cols-5'}`}>
            {weekDates.slice(0, hasSaturdaySlots ? 6 : 5).map((date) => {
              const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
              const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isPast = dateMidnight <= todayMidnight
              const isBlocked = blockedDates.includes(formatDateForSheet(date))
              const isDisabled = isPast || isBlocked
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              return (
                <button key={date.toISOString()} disabled={isDisabled} onClick={() => handleSelectDate(date)}
                  className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                    isDisabled ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                    : isSelected ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 active:scale-95 hover:bg-gray-100'}`}>
                  <span className="text-[11px] font-medium">{DAYS_JP[date.getDay()]}</span>
                  <span className="text-lg font-bold mt-1">{date.getDate()}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 空き枠 */}
        {selectedDate && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {formatDateDisplay(selectedDate)} の枠
            </h2>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">データを取得できませんでした</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {slots.filter(({ slot, booked }) => {
                    // 変更モード中は変更元スロットも表示
                    if (formMode === 'edit' && slot === editingOldSlot) return true
                    // 過去時間は非表示
                    if (!booked) {
                      const isToday = selectedDate?.toDateString() === today.toDateString()
                      if (isToday) {
                        const [h, m] = slot.split(':').map(Number)
                        if (h * 60 + m <= today.getHours() * 60 + today.getMinutes()) return false
                      }
                    }
                    // 予約可能（空き）のみ表示
                    return booked === null
                  }).map(({ slot }) => {
                    const isMoveDest = formMode === 'edit' && slot !== editingOldSlot
                    const isCurrentEdit = formMode === 'edit' && slot === editingOldSlot
                    const isNewSelected = formMode === 'new' && selectedSlot === slot
                    const isMoveSelected = formMode === 'edit' && selectedSlot === slot && slot !== editingOldSlot

                    return (
                      <button key={slot}
                        onClick={() => {
                          if (formMode === 'edit' && !isCurrentEdit) {
                            setSelectedSlot(slot)
                          } else if (formMode !== 'edit') {
                            setFormMode('new')
                            setSelectedSlot(s => s === slot ? null : slot)
                            setResult(null)
                          }
                        }}
                        className={`py-3 rounded-xl text-sm font-bold transition-all ${
                          isCurrentEdit
                            ? 'bg-orange-400 text-white ring-2 ring-orange-300'
                            : isMoveSelected
                              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                              : isMoveDest
                              ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200 active:scale-95'
                              : isNewSelected
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-blue-50 text-blue-700 active:scale-95 hover:bg-blue-100'
                        }`}>
                        {slot}
                        {isMoveDest && !isMoveSelected ? (
                          <span className="block text-[9px] mt-0.5 text-blue-400">移動先</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                {formMode === 'none' && (
                  <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 text-center">
                    <p className="text-xs text-gray-500 font-medium mb-1">予約済みの方</p>
                    <p className="text-xs text-gray-400">変更・キャンセルは下の「予約の確認・変更・キャンセル」欄にお名前を入力してください</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 名前確認フォーム */}
        {formMode === 'verify' && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">予約の変更・キャンセル</h2>
            <p className="text-xs text-gray-400 mb-4">予約時に入力したお子様のフルネームを入力してください</p>
            <input
              type="text"
              value={verifyName}
              onChange={e => { setVerifyName(e.target.value); setVerifyError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="例：山田 太郎"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 mb-2"
            />
            {verifyError && <p className="text-red-500 text-xs mb-3">{verifyError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setFormMode('none'); setVerifyName(''); setVerifyError('') }}
                className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">
                戻る
              </button>
              <button onClick={handleVerify}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">
                確認する
              </button>
            </div>
          </section>
        )}

        {/* 新規予約 / 変更フォーム */}
        {(formMode === 'new' && selectedSlot) || formMode === 'edit' ? (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                {formMode === 'edit' ? '予約の変更' : '予約内容の入力'}
              </h2>
              {formMode === 'edit' && (
                <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-1 rounded-full">変更モード</span>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-4">
              {formMode === 'edit'
                ? `変更元: ${editingOldSlot}　→　変更先: ${selectedSlot}${editingOldSlot === selectedSlot ? '（同じ枠）' : ''}`
                : `${formatDateDisplay(selectedDate!)} ${selectedSlot}`}
            </p>

            {formMode === 'edit' && editingOldSlot !== selectedSlot && (
              <div className="bg-blue-50 rounded-xl px-4 py-2 mb-4 text-xs text-blue-600">
                上の枠一覧で別の空き枠をタップすると移動先を変更できます
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">生徒名（フルネーム） *</label>
                <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">本人との関係</label>
                <input type="text" value={relation} onChange={e => setRelation(e.target.value)}
                  placeholder="例：保護者（母）、本人"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">面談希望 * <span className="font-normal text-gray-400">（所要時間：15分程度）</span></label>
                <div className="flex flex-col gap-2">
                  {meetingTypes.map(t => (
                    <button key={t} onClick={() => setMeetingType(t)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                        meetingType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {meetingType === '電話面談' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">電話番号 *</label>
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="例：090-1234-5678"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">
                  話したいこと <span className="font-normal text-gray-400">（当てはまるものを選択）</span>
                </label>
                <div className="space-y-1">
                  {TOPICS.map(topic => {
                    const checked = selectedTopics.includes(topic)
                    return (
                      <button key={topic} type="button" onClick={() => toggleTopic(topic)}
                        className="flex items-center gap-3 w-full text-left py-1.5 active:opacity-60">
                        <span className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}>
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4L3.5 7L9 1" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm text-gray-700">{topic}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">備考（任意）</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  placeholder="具体的な状況や詳細があればご記入ください"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  雑談・なんでもどうぞ <span className="font-normal text-gray-400">（任意）</span>
                </label>
                <textarea value={chatNote} onChange={e => setChatNote(e.target.value)} rows={3}
                  placeholder="悩みでも、ちょっとした疑問でも、気軽にどうぞ"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none" />
              </div>

              {result && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {result.message}
                </div>
              )}

              {formMode === 'new' ? (
                <button onClick={handleSubmitNew}
                  disabled={!studentName || submitting || (meetingType === '電話面談' && !phoneNumber)}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                  {submitting ? '送信中...' : '予約を確定する'}
                </button>
              ) : (
                <div className="space-y-2">
                  <button onClick={handleSubmitEdit}
                    disabled={!studentName || submitting || (meetingType === '電話面談' && !phoneNumber)}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                    {submitting ? '送信中...' : '変更を保存する'}
                  </button>
                  <button onClick={handleCancelBooking} disabled={submitting}
                    className="w-full border-2 border-red-200 text-red-500 font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                    この予約をキャンセルする
                  </button>
                  <button onClick={() => resetForm()} className="w-full text-gray-400 text-sm py-2">
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* 予約の確認・変更・キャンセル */}
        <section id="check-section" className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-500 flex-shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <h2 className="text-sm font-bold text-blue-800">予約の確認・変更・キャンセル</h2>
          </div>
          <p className="text-xs text-blue-600 mb-1">予約時に入力したお子様のフルネームを入力してください</p>
          <p className="text-xs text-blue-400 mb-3">※ スペースの有無に関わらず検索できます</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={checkName}
              onChange={e => { setCheckName(e.target.value); setCheckResult(null); setCheckActionResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleCheckBooking()}
              placeholder="例：山田太郎"
              className="flex-1 border border-blue-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={handleCheckBooking}
              disabled={checkLoading || !checkName.trim()}
              className="bg-blue-600 text-white font-bold px-5 rounded-xl text-sm disabled:opacity-40"
            >
              {checkLoading ? '...' : '検索'}
            </button>
          </div>
          {checkActionResult && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium mb-2 ${checkActionResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {checkActionResult.message}
            </div>
          )}
          {checkResult !== null && (
            checkResult.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-sm text-gray-500 font-medium">予約が見つかりませんでした</p>
                <p className="text-xs text-gray-400 mt-1">予約時に入力したお名前をフルネームで入力してください</p>
                <p className="text-xs text-gray-400">（例：山田太郎、山田 太郎 どちらでも可）</p>
              </div>
            ) : (
              <div className="space-y-3">
                {checkResult.map((b, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{b.date}（{b.dayOfWeek}）{b.slot}</p>
                    <p className="text-xs text-gray-500 mt-0.5 mb-3">{b.type}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleChangeFromLookup(b)}
                        disabled={checkCancelling}
                        className="flex-1 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl disabled:opacity-40"
                      >
                        時間を変更する
                      </button>
                      <button
                        onClick={() => handleCancelFromLookup(b)}
                        disabled={checkCancelling}
                        className="flex-1 py-2 border-2 border-red-200 text-red-500 text-sm font-bold rounded-xl disabled:opacity-40"
                      >
                        {checkCancelling ? '処理中...' : 'キャンセルする'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  )
}

// ── ルートコンポーネント ───────────────────────────────
export default function HomePage() {
  const [schoolId, setSchoolId] = useState<SchoolId | null>(null)
  const [teacherId, setTeacherId] = useState<string | null>(null)

  if (!schoolId) {
    return <SchoolSelect onSelect={setSchoolId} />
  }

  if (!teacherId) {
    return (
      <TeacherSelect
        schoolId={schoolId}
        onSelect={setTeacherId}
        onBack={() => setSchoolId(null)}
      />
    )
  }

  const teacher = TEACHERS.find(t => t.id === teacherId)!
  const school = SCHOOLS.find(s => s.id === schoolId)!

  return (
    <BookingPage
      teacherId={teacherId}
      schoolId={schoolId}
      teacherName={teacher.name}
      schoolName={school.name}
      weekStartDay={teacher.weekStartDay}
      onBack={() => setTeacherId(null)}
    />
  )
}

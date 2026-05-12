"use client"

import { useState, useCallback } from 'react'

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const MEETING_TYPES = ['2者面談', '3者面談']

const TOPICS = [
  '成績・学力のこと',
  '志望校・大学の選び方',
  '受験勉強の進め方',
  'モチベーション・やる気が上がらない',
  '学習習慣が身についていない',
  '部活と勉強の両立',
  '学校生活・友人関係',
  '模試の結果・偏差値について',
  '塾の授業・カリキュラムについて',
  '夏期・冬期講習について',
]

function getWeekDates(baseDate: Date): Date[] {
  const week: Date[] = []
  const day = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1))
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
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

// セルの値から生徒名を取り出す（例: "山田太郎（2者面談）" → "山田太郎"）
function extractName(cellValue: string): string {
  const m = cellValue.match(/^(.+?)（/)
  return m ? m[1] : cellValue
}
function extractType(cellValue: string): string {
  const m = cellValue.match(/（(.+?)）$/)
  return m ? m[1] : MEETING_TYPES[0]
}

type FormMode = 'none' | 'new' | 'verify' | 'edit'

export default function HomePage() {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<SlotStatus[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [formMode, setFormMode] = useState<FormMode>('none')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)   // 新規選択中の枠
  const [editingOldSlot, setEditingOldSlot] = useState<string | null>(null) // 変更元の枠
  const [verifyName, setVerifyName] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [studentName, setStudentName] = useState('')
  const [meetingType, setMeetingType] = useState(MEETING_TYPES[0])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [chatNote, setChatNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const baseDate = new Date(today)
  baseDate.setDate(today.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(baseDate)

  const loadSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true)
    setSlots([])
    const dateStr = formatDateForSheet(date)
    try {
      const res = await fetch(`/api/bookings?date=${encodeURIComponent(dateStr)}`)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  const resetForm = () => {
    setFormMode('none')
    setSelectedSlot(null)
    setEditingOldSlot(null)
    setVerifyName('')
    setVerifyError('')
    setStudentName('')
    setMeetingType(MEETING_TYPES[0])
    setSelectedTopics([])
    setNote('')
    setChatNote('')
    setResult(null)
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
      selectedTopics.length ? `【話したいこと】${selectedTopics.join('、')}` : '',
      note ? `【備考】${note}` : '',
      chatNote ? `【雑談】${chatNote}` : '',
    ].filter(Boolean).join('\n')

  // 名前照合して変更フォームへ
  const handleVerify = () => {
    const name = verifyName.trim()
    if (!name) { setVerifyError('名前を入力してください'); return }
    const found = slots.find(s => s.booked && extractName(s.booked) === name)
    if (!found) {
      setVerifyError('その名前の予約が見つかりませんでした。フルネームで入力してください')
      return
    }
    setEditingOldSlot(found.slot)
    setSelectedSlot(found.slot)
    setStudentName(extractName(found.booked!))
    setMeetingType(extractType(found.booked!))
    setSelectedTopics([])
    setNote('')
    setChatNote('')
    setVerifyError('')
    setFormMode('edit')
  }

  const handleSubmitNew = async () => {
    if (!selectedDate || !selectedSlot || !studentName) return
    setSubmitting(true); setResult(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        resetForm()
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
        resetForm()
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
          date: formatDateForSheet(selectedDate),
          slot: editingOldSlot,
          studentName,
        }),
      })
      if (res.ok) {
        setResult({ ok: true, message: '予約をキャンセルしました' })
        resetForm()
        loadSlots(selectedDate)
      } else {
        const data = await res.json()
        setResult({ ok: false, message: data.error || 'キャンセルに失敗しました' })
      }
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">面談予約</h1>
          <p className="text-sm text-gray-500 mt-0.5">日程を選択して予約してください</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 週ナビゲーション */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl">‹</button>
            <span className="text-sm font-semibold text-gray-700">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[4].getDate()}日
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl">›</button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weekDates.map((date) => {
              const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              return (
                <button key={date.toISOString()} disabled={isPast} onClick={() => handleSelectDate(date)}
                  className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                    isPast ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
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
                  {slots.map(({ slot, booked }) => {
                    const isMoveDest = formMode === 'edit' && !booked && slot !== editingOldSlot
                    const isCurrentEdit = formMode === 'edit' && slot === editingOldSlot
                    const isNewSelected = formMode === 'new' && selectedSlot === slot
                    const isMoveSelected = formMode === 'edit' && selectedSlot === slot && slot !== editingOldSlot

                    return (
                      <button key={slot}
                        disabled={!!booked && formMode !== 'edit'}
                        onClick={() => {
                          if (formMode === 'edit' && !booked) {
                            setSelectedSlot(slot) // 移動先を変更
                          } else if (!booked && formMode !== 'edit') {
                            setFormMode('new')
                            setSelectedSlot(s => s === slot ? null : slot)
                            setResult(null)
                          }
                        }}
                        className={`py-3 rounded-xl text-sm font-bold transition-all ${
                          booked
                            ? isCurrentEdit
                              ? 'bg-orange-400 text-white ring-2 ring-orange-300'
                              : 'bg-red-100 text-red-600 cursor-default'
                            : isMoveSelected
                              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                              : isMoveDest
                              ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200 active:scale-95'
                              : isNewSelected
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-blue-50 text-blue-700 active:scale-95 hover:bg-blue-100'
                        }`}>
                        {slot}
                        {booked ? (
                          <span className="block text-[9px] mt-0.5 text-red-400">
                            予約済み
                          </span>
                        ) : isMoveDest ? (
                          <span className="block text-[9px] mt-0.5 text-blue-400">移動先</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                {/* 変更ボタン */}
                {formMode === 'none' && slots.some(s => s.booked) && (
                  <button onClick={() => { setFormMode('verify'); setResult(null) }}
                    className="w-full border border-gray-200 text-gray-500 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 active:scale-[0.99] transition-all">
                    予約の変更・キャンセルを希望する
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* 名前確認フォーム（変更前） */}
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

        {/* 新規予約フォーム / 変更フォーム */}
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">面談希望 *</label>
                <div className="flex gap-2">
                  {MEETING_TYPES.map(t => (
                    <button key={t} onClick={() => setMeetingType(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                        meetingType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">
                  話したいこと <span className="font-normal text-gray-400">（当てはまるものを選択）</span>
                </label>
                <div className="space-y-2">
                  {TOPICS.map(topic => (
                    <label key={topic} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selectedTopics.includes(topic)}
                        onChange={() => toggleTopic(topic)}
                        className="w-4 h-4 rounded accent-blue-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{topic}</span>
                    </label>
                  ))}
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
                <button onClick={handleSubmitNew} disabled={!studentName || submitting}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                  {submitting ? '送信中...' : '予約を確定する'}
                </button>
              ) : (
                <div className="space-y-2">
                  <button onClick={handleSubmitEdit} disabled={!studentName || submitting}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                    {submitting ? '送信中...' : '変更を保存する'}
                  </button>
                  <button onClick={handleCancelBooking} disabled={submitting}
                    className="w-full border-2 border-red-200 text-red-500 font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all">
                    この予約をキャンセルする
                  </button>
                  <button onClick={resetForm} className="w-full text-gray-400 text-sm py-2">
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

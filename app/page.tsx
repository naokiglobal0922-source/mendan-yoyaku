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

export default function HomePage() {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<SlotStatus[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
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
    setSelectedSlot(null)
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

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    setResult(null)
    loadSlots(date)
  }

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot || !studentName) return
    setSubmitting(true)
    setResult(null)

    const noteText = [
      selectedTopics.length ? `【話したいこと】${selectedTopics.join('、')}` : '',
      note ? `【備考】${note}` : '',
      chatNote ? `【雑談】${chatNote}` : '',
    ].filter(Boolean).join('\n')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formatDateForSheet(selectedDate),
          slot: selectedSlot,
          studentName,
          type: meetingType,
          note: noteText,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: '予約が完了しました！' })
        setSelectedSlot(null)
        setStudentName('')
        setSelectedTopics([])
        setNote('')
        setChatNote('')
        loadSlots(selectedDate)
      } else {
        setResult({ ok: false, message: data.error || '予約に失敗しました' })
      }
    } catch {
      setResult({ ok: false, message: '通信エラーが発生しました' })
    } finally {
      setSubmitting(false)
    }
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
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[4].getDate()}日
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 text-xl"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {weekDates.map((date) => {
              const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              return (
                <button
                  key={date.toISOString()}
                  disabled={isPast}
                  onClick={() => handleSelectDate(date)}
                  className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                    isPast
                      ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 active:scale-95 hover:bg-gray-100'
                  }`}
                >
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
              {formatDateDisplay(selectedDate)} の空き枠
            </h2>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">データを取得できませんでした</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map(({ slot, booked }) => (
                  <button
                    key={slot}
                    disabled={!!booked}
                    onClick={() => setSelectedSlot(s => s === slot ? null : slot)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      booked
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : selectedSlot === slot
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-blue-50 text-blue-700 active:scale-95 hover:bg-blue-100'
                    }`}
                  >
                    {slot}
                    {booked && <span className="block text-[9px] mt-0.5 text-gray-400">予約済</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 予約フォーム */}
        {selectedSlot && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              予約内容の入力 — {formatDateDisplay(selectedDate!)} {selectedSlot}
            </h2>

            <div className="space-y-5">
              {/* 生徒名（記述） */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">生徒名 *</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="お子様のお名前を入力してください"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>

              {/* 面談希望 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">面談希望 *</label>
                <div className="flex gap-2">
                  {MEETING_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setMeetingType(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                        meetingType === t
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 話したいこと（選択式） */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">
                  話したいこと <span className="font-normal text-gray-400">（当てはまるものを選択）</span>
                </label>
                <div className="space-y-2">
                  {TOPICS.map(topic => (
                    <label key={topic} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={() => toggleTopic(topic)}
                        className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700">{topic}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">備考（任意）</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="具体的な状況や詳細があればご記入ください"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                />
              </div>

              {/* 雑談 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  雑談・なんでもどうぞ <span className="font-normal text-gray-400">（任意）</span>
                </label>
                <textarea
                  value={chatNote}
                  onChange={e => setChatNote(e.target.value)}
                  rows={3}
                  placeholder="悩みでも、ちょっとした疑問でも、気軽にどうぞ"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                />
              </div>

              {result && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {result.message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!studentName || submitting}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl disabled:opacity-40 active:scale-[0.99] transition-all"
              >
                {submitting ? '送信中...' : '予約を確定する'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

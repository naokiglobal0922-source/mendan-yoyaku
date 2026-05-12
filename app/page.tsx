"use client"

import { useState, useCallback, useEffect } from 'react'

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

interface SlotStatus { slot: string; booked: string | null }

function extractName(v: string) { return v.match(/^(.+?)（/)?.[1] ?? v }
function extractType(v: string) { return v.match(/（(.+?)）$/)?.[1] ?? MEETING_TYPES[0] }

type FormMode = 'none' | 'new' | 'verify' | 'edit'

export default function HomePage() {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<SlotStatus[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [blockedDates, setBlockedDates] = useState<string[]>([])

  const [formMode, setFormMode] = useState<FormMode>('none')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [editingOldSlot, setEditingOldSlot] = useState<string | null>(null)
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

  useEffect(() => {
    fetch('/api/blocked-dates').then(r => r.json()).then(d => setBlockedDates(d.dates || []))
  }, [])

  const loadSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true); setSlots([])
    try {
      const res = await fetch(`/api/bookings?date=${encodeURIComponent(formatDateForSheet(date))}`)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch { setSlots([]) }
    finally { setLoadingSlots(false) }
  }, [])

  const resetForm = () => {
    setFormMode('none'); setSelectedSlot(null); setEditingOldSlot(null)
    setVerifyName(''); setVerifyError(''); setStudentName('')
    setMeetingType(MEETING_TYPES[0]); setSelectedTopics([])
    setNote(''); setChatNote(''); setResult(null)
  }

  const handleSelectDate = (date: Date) => { setSelectedDate(date); resetForm(); loadSlots(date) }
  const toggleTopic = (t: string) => setSelectedTopics(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const buildNote = () => [
    selectedTopics.length ? `【話したいこと】${selectedTopics.join('、')}` : '',
    note ? `【備考】${note}` : '',
    chatNote ? `【雑談】${chatNote}` : '',
  ].filter(Boolean).join('\n')

  const handleVerify = () => {
    const name = verifyName.trim()
    if (!name) { setVerifyError('名前を入力してください'); return }
    const found = slots.find(s => s.booked && s.booked !== '__blocked__' && extractName(s.booked) === name)
    if (!found) { setVerifyError('その名前の予約が見つかりませんでした'); return }
    setEditingOldSlot(found.slot); setSelectedSlot(found.slot)
    setStudentName(extractName(found.booked!)); setMeetingType(extractType(found.booked!))
    setSelectedTopics([]); setNote(''); setChatNote(''); setVerifyError(''); setFormMode('edit')
  }

  const post = async (method: string, body: object) => {
    const res = await fetch('/api/bookings', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res
  }

  const handleSubmitNew = async () => {
    if (!selectedDate || !selectedSlot || !studentName) return
    setSubmitting(true); setResult(null)
    try {
      const res = await post('POST', { date: formatDateForSheet(selectedDate), slot: selectedSlot, studentName, type: meetingType, note: buildNote() })
      const data = await res.json()
      if (res.ok) { setResult({ ok: true, message: '予約が完了しました！' }); resetForm(); loadSlots(selectedDate) }
      else setResult({ ok: false, message: data.error || '予約に失敗しました' })
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  const handleSubmitEdit = async () => {
    if (!selectedDate || !selectedSlot || !editingOldSlot || !studentName) return
    setSubmitting(true); setResult(null)
    try {
      const res = await post('PUT', { date: formatDateForSheet(selectedDate), oldSlot: editingOldSlot, newSlot: selectedSlot, studentName, type: meetingType, note: buildNote() })
      const data = await res.json()
      if (res.ok) { setResult({ ok: true, message: '予約を変更しました！' }); resetForm(); loadSlots(selectedDate) }
      else setResult({ ok: false, message: data.error || '変更に失敗しました' })
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  const handleCancelBooking = async () => {
    if (!selectedDate || !editingOldSlot || !confirm('この予約をキャンセルしますか？')) return
    setSubmitting(true)
    try {
      const res = await post('DELETE', { date: formatDateForSheet(selectedDate), slot: editingOldSlot, studentName })
      if (res.ok) { setResult({ ok: true, message: '予約をキャンセルしました' }); resetForm(); loadSlots(selectedDate) }
      else { const d = await res.json(); setResult({ ok: false, message: d.error || 'キャンセルに失敗しました' }) }
    } catch { setResult({ ok: false, message: '通信エラーが発生しました' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-lg mx-auto px-5 py-5">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-1">Interview</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">面談予約</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-7 space-y-5">

        {/* 週カレンダー */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setWeekOffset(w => w - 1)} disabled={weekOffset <= 0}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-25 active:scale-90 transition-transform text-lg font-bold">‹</button>
            <span className="text-sm font-semibold text-slate-600">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日（月）〜 {weekDates[4].getDate()}日（金）
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-90 transition-transform text-lg font-bold">›</button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {weekDates.map(date => {
              const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isBlocked = blockedDates.includes(formatDateForSheet(date))
              const isDisabled = isPast || isBlocked
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              return (
                <button key={date.toISOString()} disabled={isDisabled} onClick={() => handleSelectDate(date)}
                  className={`flex flex-col items-center gap-1 py-3.5 rounded-2xl font-semibold transition-all ${
                    isDisabled ? 'text-slate-200 cursor-not-allowed'
                    : isSelected ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95'
                  }`}>
                  <span className="text-[10px] tracking-wide">{DAYS_JP[date.getDay()]}</span>
                  <span className="text-xl font-black">{date.getDate()}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 空き枠 */}
        {selectedDate && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-bold text-slate-800">{formatDateDisplay(selectedDate)}</h2>
              <span className="text-xs text-slate-400">空き枠を選択</span>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">データを取得できませんでした</p>
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
                          if (formMode === 'edit' && !booked) { setSelectedSlot(slot) }
                          else if (!booked && formMode !== 'edit') { setFormMode('new'); setSelectedSlot(s => s === slot ? null : slot); setResult(null) }
                        }}
                        className={`py-3.5 rounded-2xl text-sm font-bold transition-all ${
                          booked
                            ? isCurrentEdit ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : isMoveSelected ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 ring-2 ring-slate-400'
                            : isMoveDest ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-300 active:scale-95'
                            : isNewSelected ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95'
                        }`}>
                        {slot}
                        {booked ? (
                          <span className="block text-[9px] mt-0.5 text-slate-400 font-normal">予約不可</span>
                        ) : isMoveDest ? (
                          <span className="block text-[9px] mt-0.5 text-slate-500 font-normal">移動先</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                {formMode === 'none' && slots.some(s => s.booked && s.booked !== '__blocked__') && (
                  <button onClick={() => { setFormMode('verify'); setResult(null) }}
                    className="w-full border border-slate-200 text-slate-500 text-sm font-semibold py-3 rounded-2xl hover:bg-slate-50 active:scale-[0.99] transition-all">
                    予約の変更・キャンセルを希望する
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* 名前確認 */}
        {formMode === 'verify' && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-bold text-slate-800 mb-1">予約の変更・キャンセル</h2>
            <p className="text-xs text-slate-400 mb-4">予約時のお子様のフルネームを入力してください</p>
            <input type="text" value={verifyName}
              onChange={e => { setVerifyName(e.target.value); setVerifyError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="例：山田 太郎"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-2" />
            {verifyError && <p className="text-red-500 text-xs mb-3">{verifyError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setFormMode('none'); setVerifyName(''); setVerifyError('') }}
                className="flex-1 border border-slate-200 text-slate-500 font-semibold py-3 rounded-2xl text-sm">戻る</button>
              <button onClick={handleVerify}
                className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-2xl text-sm">確認する</button>
            </div>
          </section>
        )}

        {/* 予約フォーム */}
        {((formMode === 'new' && selectedSlot) || formMode === 'edit') && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-slate-800">
                {formMode === 'edit' ? '予約の変更' : '予約内容の入力'}
              </h2>
              {formMode === 'edit' && (
                <span className="text-[11px] bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">変更モード</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-5">
              {formMode === 'edit'
                ? `${editingOldSlot}${editingOldSlot !== selectedSlot ? ` → ${selectedSlot}` : ''}`
                : `${formatDateDisplay(selectedDate!)}　${selectedSlot}`}
            </p>

            {formMode === 'edit' && editingOldSlot !== selectedSlot && (
              <div className="bg-slate-50 rounded-2xl px-4 py-3 mb-5 text-xs text-slate-500">
                上の枠から別の空き枠をタップして移動先を変更できます
              </div>
            )}

            <div className="space-y-5">
              {/* 生徒名 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">生徒名（フルネーム）*</label>
                <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              {/* 面談希望 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">面談希望 *</label>
                <div className="flex gap-2">
                  {MEETING_TYPES.map(t => (
                    <button key={t} onClick={() => setMeetingType(t)}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        meetingType === t ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* 話したいこと */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  話したいこと <span className="normal-case font-normal text-slate-400">（複数選択可）</span>
                </label>
                <div className="space-y-2.5">
                  {TOPICS.map(topic => (
                    <label key={topic} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedTopics.includes(topic) ? 'bg-slate-900 border-slate-900' : 'border-slate-200 group-hover:border-slate-400'
                      }`}>
                        {selectedTopics.includes(topic) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" className="hidden" checked={selectedTopics.includes(topic)} onChange={() => toggleTopic(topic)} />
                      <span className="text-sm text-slate-700">{topic}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">備考（任意）</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  placeholder="具体的な状況や詳細があればご記入ください"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
              </div>

              {/* 雑談 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">なんでもどうぞ（任意）</label>
                <textarea value={chatNote} onChange={e => setChatNote(e.target.value)} rows={3}
                  placeholder="ちょっとした疑問や雑談でも気軽にどうぞ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
              </div>

              {result && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {result.message}
                </div>
              )}

              {formMode === 'new' ? (
                <button onClick={handleSubmitNew} disabled={!studentName || submitting}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl disabled:opacity-30 active:scale-[0.99] transition-all text-sm tracking-wide">
                  {submitting ? '送信中...' : '予約を確定する'}
                </button>
              ) : (
                <div className="space-y-2">
                  <button onClick={handleSubmitEdit} disabled={!studentName || submitting}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl disabled:opacity-30 active:scale-[0.99] transition-all text-sm">
                    {submitting ? '送信中...' : '変更を保存する'}
                  </button>
                  <button onClick={handleCancelBooking} disabled={submitting}
                    className="w-full border border-red-200 text-red-400 font-semibold py-3.5 rounded-2xl disabled:opacity-30 active:scale-[0.99] transition-all text-sm">
                    この予約をキャンセルする
                  </button>
                  <button onClick={resetForm} className="w-full text-slate-300 text-sm py-2">閉じる</button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

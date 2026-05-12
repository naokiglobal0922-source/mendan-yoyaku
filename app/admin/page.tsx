"use client"

import { useState, useEffect } from 'react'

interface BookingEntry {
  date: string
  dayOfWeek: string
  slots: Record<string, string>
}

function encodeBasicAuth(password: string) {
  return 'Basic ' + btoa(`:${password}`)
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'bookings' | 'students' | 'interviews'>('bookings')

  const [bookings, setBookings] = useState<BookingEntry[]>([])
  const [students, setStudents] = useState<string[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  const [interviewName, setInterviewName] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const authHeader = encodeBasicAuth(password)

  const verify = async () => {
    const res = await fetch('/api/admin/students', {
      headers: { Authorization: authHeader },
    })
    if (res.ok) {
      setAuthed(true)
      setAuthError('')
      const data = await res.json()
      setStudents(data.students || [])
    } else {
      setAuthError('パスワードが違います')
    }
  }

  const loadStudents = async () => {
    const res = await fetch('/api/admin/students', { headers: { Authorization: authHeader } })
    const data = await res.json()
    setStudents(data.students || [])
  }

  const loadBookings = async () => {
    const res = await fetch('/api/bookings/all', { headers: { Authorization: authHeader } })
    if (res.ok) {
      const data = await res.json()
      setBookings(data.bookings || [])
    }
  }

  useEffect(() => {
    if (authed && tab === 'bookings') loadBookings()
    if (authed && (tab === 'students' || tab === 'interviews')) loadStudents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab])

  const addStudent = async () => {
    if (!newStudentName.trim()) return
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ name: newStudentName.trim() }),
    })
    if (res.ok) {
      setMessage({ ok: true, text: `${newStudentName} を追加しました` })
      setNewStudentName('')
      loadStudents()
    } else {
      setMessage({ ok: false, text: '追加に失敗しました' })
    }
  }

  const deleteStudent = async (name: string) => {
    if (!confirm(`${name} を削除しますか？`)) return
    const res = await fetch('/api/admin/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setMessage({ ok: true, text: `${name} を削除しました` })
      loadStudents()
    }
  }

  const markInterview = async () => {
    if (!interviewName || !interviewDate) return
    const res = await fetch('/api/admin/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ name: interviewName, date: interviewDate }),
    })
    if (res.ok) {
      setMessage({ ok: true, text: `${interviewName} の面談済みを記録しました` })
      setInterviewName('')
      setInterviewDate('')
    } else {
      setMessage({ ok: false, text: '記録に失敗しました' })
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">管理者ログイン</h1>
          <p className="text-sm text-gray-500 mb-6">パスワードを入力してください</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="パスワード"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
          {authError && <p className="text-red-500 text-sm mb-3">{authError}</p>}
          <button
            onClick={verify}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl"
          >
            ログイン
          </button>
        </div>
      </div>
    )
  }

  const TABS = [
    { key: 'bookings', label: '予約一覧' },
    { key: 'students', label: '名簿管理' },
    { key: 'interviews', label: '面談済み記録' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">管理者画面</h1>
          <button
            onClick={() => { setAuthed(false); setPassword('') }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* タブ */}
        <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setMessage(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium mb-4 ${
            message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        {/* 予約一覧 */}
        {tab === 'bookings' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">予約一覧（月〜金）</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">予約データを読み込んでいます...</p>
            ) : (
              <div className="space-y-3">
                {bookings
                  .filter(b => Object.keys(b.slots).length > 0)
                  .map(b => (
                    <div key={b.date} className="border border-gray-100 rounded-xl p-3">
                      <p className="font-bold text-sm text-gray-900 mb-2">
                        {b.date} ({b.dayOfWeek})
                      </p>
                      <div className="space-y-1">
                        {Object.entries(b.slots).map(([time, name]) => (
                          <div key={time} className="flex items-center gap-2 text-sm">
                            <span className="text-blue-600 font-mono w-12 flex-shrink-0">{time}</span>
                            <span className="text-gray-700">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 名簿管理 */}
        {tab === 'students' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">生徒名簿</h2>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStudent()}
                placeholder="生徒名を入力"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addStudent}
                className="bg-blue-600 text-white font-bold px-5 rounded-xl text-sm"
              >
                追加
              </button>
            </div>

            <div className="space-y-2">
              {students.map(s => (
                <div key={s} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{s}</span>
                  <button
                    onClick={() => deleteStudent(s)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    削除
                  </button>
                </div>
              ))}
              {students.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">生徒が登録されていません</p>
              )}
            </div>
          </div>
        )}

        {/* 面談済み記録 */}
        {tab === 'interviews' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">面談済みチェック</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">生徒名</label>
                <select
                  value={interviewName}
                  onChange={e => setInterviewName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                >
                  <option value="">選択してください</option>
                  {students.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">面談実施日</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={e => setInterviewDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>

              <button
                onClick={markInterview}
                disabled={!interviewName || !interviewDate}
                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl disabled:opacity-40"
              >
                面談済みとして記録する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

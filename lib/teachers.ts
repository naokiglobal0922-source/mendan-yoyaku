export const SCHOOLS = [
  { id: 'tsuruse', name: 'EIMEI予備校鶴瀬校舎' },
  { id: 'fujimino', name: 'EIMEI予備校ふじみ野校舎' },
] as const

export type SchoolId = typeof SCHOOLS[number]['id']

export const TEACHERS = [
  { id: 'haraguchi', name: '原口直樹',  schools: ['tsuruse'] as SchoolId[],           weekStartDay: 1 },
  { id: 'okamiya',   name: '岡宮唯央奈', schools: ['tsuruse', 'fujimino'] as SchoolId[], weekStartDay: 2 },
  { id: 'futagami',  name: '二神大輝',  schools: ['fujimino'] as SchoolId[],           weekStartDay: 1 },
] as const

export type TeacherId = typeof TEACHERS[number]['id']

const SCHOOL_TEACHER_ORDER: Record<string, string[]> = {
  fujimino: ['futagami', 'okamiya'],
}

export function getTeachersBySchool(schoolId: string) {
  const filtered = TEACHERS.filter(t => (t.schools as readonly string[]).includes(schoolId))
  const order = SCHOOL_TEACHER_ORDER[schoolId]
  if (!order) return filtered
  return [...filtered].sort((a, b) => {
    const ai = order.indexOf(a.id)
    const bi = order.indexOf(b.id)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

export function getTeacher(teacherId: string) {
  return TEACHERS.find(t => t.id === teacherId) ?? null
}

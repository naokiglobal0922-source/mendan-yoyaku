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

export function getTeachersBySchool(schoolId: string) {
  return TEACHERS.filter(t => (t.schools as readonly string[]).includes(schoolId))
}

export function getTeacher(teacherId: string) {
  return TEACHERS.find(t => t.id === teacherId) ?? null
}

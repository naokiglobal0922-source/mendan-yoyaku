export const SCHOOLS = [
  { id: 'tsuruse', name: 'EIMEI予備校鶴瀬校舎' },
  { id: 'fujimino', name: 'EIMEI予備校ふじみ野校舎' },
  { id: 'kawagoe', name: 'EIMEI予備校川越校舎' },
] as const

export type SchoolId = typeof SCHOOLS[number]['id']

export const TEACHERS = [
  { id: 'haraguchi', name: '原口直樹',  title: '塾長', schools: ['tsuruse'] as SchoolId[],           weekStartDay: 1 },
  { id: 'okamiya',   name: '岡宮唯央奈', title: undefined, schools: ['tsuruse', 'fujimino'] as SchoolId[], weekStartDay: 2 },
  { id: 'futagami',  name: '二神大輝',  title: '塾長', schools: ['fujimino', 'kawagoe'] as SchoolId[], weekStartDay: 1 },
] as const

export type TeacherId = typeof TEACHERS[number]['id']

// エイメイ/明成個別の高等部の生徒が相談できる先生（塾長のみ）
export const KOUTOUBU_TEACHER_IDS: TeacherId[] = ['haraguchi', 'futagami']

const SCHOOL_TEACHER_ORDER: Record<string, string[]> = {
  fujimino: ['futagami', 'okamiya'],
  kawagoe: ['futagami'],
}

export function getTeachersBySchool(schoolId: string, teacherIds?: readonly string[]) {
  let filtered = TEACHERS.filter(t => (t.schools as readonly string[]).includes(schoolId))
  if (teacherIds) filtered = filtered.filter(t => teacherIds.includes(t.id))
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

// エイメイ/明成個別の高等部の「通っている校舎」選択肢
export const KOUTOUBU_SCHOOLS = [
  'EIMEI予備校｜EMiL個別　鶴瀬',
  'EIMEI予備校｜EMiL個別　ふじみ野駅前',
  'EIMEI予備校｜EMiL個別　川越',
  'エイメイ学院　みずほ台',
  'エイメイ学院　鶴瀬',
  'エイメイ学院｜明成個別　ふじみ野上福岡',
  'エイメイ学院｜明成個別　トナリエふじみ野',
  'エイメイ学院｜明成個別　水谷',
  'エイメイ学院｜明成個別　富士見羽沢',
  'エイメイ学院｜明成個別　うれし野',
  'エイメイ学院｜明成個別　朝霞根岸台',
  '明成個別　ふじみ野西口',
  '明成個別　鶴瀬東',
  '明成個別　新河岸',
  '明成個別　志木',
  '明成個別　朝霞台',
  '明成個別　南古谷',
  '明成個別　鶴瀬西',
  '明成個別　三芳藤久保',
  '明成個別　南大塚',
  '明成個別　志木柳瀬川',
  'Luce個別　みずほ台',
  'Elena女子個別',
  'お通いでない',
] as const

export const KOUTOUBU_GRADES = ['高校1年生', '高校2年生', '高校3年生', '既卒'] as const

export const KOUTOUBU_EXAM_TYPES = ['一般', '指定校', '総合型・公募推薦', '未定'] as const

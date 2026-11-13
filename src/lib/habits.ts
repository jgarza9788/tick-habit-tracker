export type Habit = {
  id: string
  name: string
  emoji: string
  createdAt: string // YYYY-MM-DD (local)
  days: Record<string, true>
  /** Hidden from the Today list and dashboard; history is kept. Missing on older data. */
  archived?: boolean
  note?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Local date as YYYY-MM-DD. */
export const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Monday-based week start. */
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

/** The n days ending on `end` (inclusive), oldest first. */
export const lastDays = (end: Date, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))

/** Consecutive done days ending today (or yesterday if today isn't done yet). */
export function streak(h: Habit, today: Date) {
  let d = today
  if (!h.days[fmt(d)]) d = addDays(d, -1)
  let n = 0
  while (h.days[fmt(d)]) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** A day counts for a habit once it exists, or if it was ticked anyway. */
export const counts = (h: Habit, key: string) => key >= h.createdAt || !!h.days[key]

/** Completion rate (0..1) across the habits and days given, or null if nothing applies. */
export function rate(habits: Habit[], days: Date[]) {
  let total = 0
  let done = 0
  for (const h of habits)
    for (const d of days) {
      const key = fmt(d)
      if (!counts(h, key)) continue
      total++
      if (h.days[key]) done++
    }
  return total ? done / total : null
}

/** Longest run of consecutive done days, ever. */
export function longestStreak(h: Habit) {
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const key of Object.keys(h.days).sort()) {
    const [y, m, d] = key.split("-").map(Number)
    const expected: string | null = prev ? fmt(addDays(new Date(y, m - 1, d), -1)) : null
    run = prev !== null && prev === expected ? run + 1 : 1
    best = Math.max(best, run)
    prev = key
  }
  return best
}

/** Completion rate (0..1) from the habit's first day through today, or null if it has no days yet. */
export function lifetimeRate(h: Habit, today: Date) {
  const first = Object.keys(h.days).sort()[0]
  const startKey = first && first < h.createdAt ? first : h.createdAt
  const [y, m, d] = startKey.split("-").map(Number)
  let total = 0
  let done = 0
  for (let day = new Date(y, m - 1, d); day <= today; day = addDays(day, 1)) {
    const key = fmt(day)
    if (!counts(h, key)) continue
    total++
    if (h.days[key]) done++
  }
  return total ? done / total : null
}

/** Completion rate per Monday-based week for the last n weeks (the current week only counts through today). */
export function weeklyRates(h: Habit, today: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const start = startOfWeek(addDays(today, -7 * (n - 1 - i)))
    const days = Array.from({ length: 7 }, (_, k) => addDays(start, k)).filter((day) => day <= today)
    return { start, rate: rate([h], days) }
  })
}

/** Cells for a Monday-first month calendar: leading nulls pad the first week. */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const count = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))]
}

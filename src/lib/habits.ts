export type Habit = {
  id: string
  name: string
  emoji: string
  createdAt: string // YYYY-MM-DD (local)
  days: Record<string, true>
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

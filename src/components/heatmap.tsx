import { useEffect, useMemo, useRef, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays, counts, fmt, startOfWeek, type Habit } from "@/lib/habits"

const GAP = 3 // px between cells
const MIN_CELL = 10 // px; decides how many weeks fit
const LABEL_W = 30 // px reserved for the Mon/Wed/Fri labels

/** Intensity 0-4 from the share of applicable habits completed that day. */
function levelFor(done: number, total: number) {
  if (done === 0 || total === 0) return 0
  const r = done / total
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r < 1 ? 3 : 4
}

type Day = { key: string; date: Date; done: number; total: number; future: boolean; today: boolean }

export function Heatmap({ habits, today, className, style }: { habits: Habit[]; today: Date; className?: string; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null)
  const [weeks, setWeeks] = useState(26)

  // As many weeks as fit (up to a year), so it reads well on a phone and on desktop.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width - LABEL_W
      setWeeks(Math.max(8, Math.min(53, Math.floor((room + GAP) / (MIN_CELL + GAP)))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { columns, ticks, activeDays } = useMemo(() => {
    const todayKey = fmt(today)
    const lastSunday = addDays(startOfWeek(today), 6)
    const first = addDays(lastSunday, -(weeks * 7 - 1))
    let ticks = 0
    let activeDays = 0
    const columns: Day[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: Day[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(first, w * 7 + d)
        const key = fmt(date)
        const future = key > todayKey
        let done = 0
        let total = 0
        if (!future) {
          for (const h of habits) {
            if (h.days[key]) done++
            if (counts(h, key)) total++
          }
          ticks += done
          if (done) activeDays++
        }
        col.push({ key, date, done, total, future, today: key === todayKey })
      }
      columns.push(col)
    }
    return { columns, ticks, activeDays }
  }, [habits, today, weeks])

  return (
    <Card className={className} style={style}>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          {ticks} {ticks === 1 ? "tick" : "ticks"} on {activeDays} {activeDays === 1 ? "day" : "days"} in the last{" "}
          {weeks} weeks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={box} className="flex flex-col gap-1.5">
          {/* month labels */}
          <div className="flex">
            <div style={{ width: LABEL_W }} className="shrink-0" />
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, columnGap: GAP }}>
              {columns.map((col, i) => {
                const first = col[0].date
                const show = first.getDate() <= 7 && (i > 0 || first.getDate() <= 3)
                return (
                  <span key={col[0].key} className="overflow-visible text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                    {show ? first.toLocaleDateString(undefined, { month: "short" }) : ""}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="flex">
            <div
              style={{ width: LABEL_W, rowGap: GAP }}
              className="grid shrink-0 grid-rows-7 pr-2 text-[10px] leading-none text-muted-foreground"
              aria-hidden="true"
            >
              {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => (
                <span key={i} className="flex items-center">
                  {l}
                </span>
              ))}
            </div>
            <div
              role="img"
              aria-label={`Activity heatmap: ${ticks} ticks on ${activeDays} days in the last ${weeks} weeks`}
              className="grid flex-1 grid-flow-col grid-rows-7"
              style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap: GAP }}
            >
              {columns.map((col, c) =>
                col.map((day) => (
                  <div
                    key={day.key}
                    className="heat-cell heat-in aspect-square rounded-[3px]"
                    data-level={levelFor(day.done, day.total)}
                    data-future={day.future}
                    data-today={day.today}
                    style={{ "--c": c } as React.CSSProperties}
                    title={
                      day.future
                        ? undefined
                        : `${day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${day.done} of ${day.total} ${day.total === 1 ? "habit" : "habits"}`
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground" aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="heat-cell size-2.5 rounded-[3px]" data-level={l} />
            ))}
            More
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

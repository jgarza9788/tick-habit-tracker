import { ChevronRightIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heatmap } from "@/components/heatmap"
import { AnimatedNumber, GrowProgress } from "@/components/motion"
import { habitHref } from "@/lib/route"
import { tierFor } from "@/lib/streaks"
import { fmt, lastDays, rate, streak, type Habit } from "@/lib/habits"

const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`)

export function Stat({ title, value, hint, index }: { title: string; value: React.ReactNode; hint: string; index: number }) {
  return (
    <Card size="sm" className="rise-in" style={{ "--i": index } as React.CSSProperties}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="truncate text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

export function Dashboard({ habits, today }: { habits: Habit[]; today: Date }) {
  const todayKey = fmt(today)
  const doneToday = habits.filter((h) => h.days[todayKey]).length
  const best = habits.reduce<{ n: number; name: string }>(
    (acc, h) => {
      const n = streak(h, today)
      return n > acc.n ? { n, name: h.name } : acc
    },
    { n: 0, name: "" }
  )
  const week = lastDays(today, 7)
  const weekRate = rate(habits, week)
  const totalTicks = habits.reduce((sum, h) => sum + Object.keys(h.days).length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat index={0} title="Today" value={<AnimatedNumber value={doneToday} format={(n) => `${n}/${habits.length}`} />} hint={doneToday === habits.length && habits.length ? "All done 🎉" : "habits completed"} />
        <Stat index={1} title="Best streak" value={best.n ? <AnimatedNumber value={best.n} format={(n) => `${n}d`} /> : "–"} hint={best.n ? `${tierFor(best.n).name} · ${best.name}` : "Start one today"} />
        <Stat index={2} title="Last 7 days" value={weekRate === null ? "–" : <AnimatedNumber value={Math.round(weekRate * 100)} format={(n) => `${n}%`} />} hint="completion rate" />
        <Stat index={3} title="Total ticks" value={<AnimatedNumber value={totalTicks} />} hint="all time" />
      </div>

      <Heatmap habits={habits} today={today} className="rise-in" style={{ "--i": 4 } as React.CSSProperties} />

      <Card className="rise-in" style={{ "--i": 5 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>This week by habit</CardTitle>
          <CardDescription>Completion over the last 7 days · tap a habit for its details</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {habits.map((h) => {
            const r = rate([h], week)
            const done = week.filter((d) => h.days[fmt(d)]).length
            return (
              <a
                key={h.id}
                href={habitHref(h.id)}
                title={`Open ${h.name}`}
                className="group press flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 shadow-xs outline-none transition-colors hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    {h.emoji} {h.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {done}/7 · {pct(r)}
                    <span className="ml-1 grid size-6 place-items-center rounded-full bg-background text-foreground ring-1 ring-border transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
                      <ChevronRightIcon className="size-4" aria-hidden="true" />
                    </span>
                  </span>
                </div>
                <GrowProgress value={Math.round((r ?? 0) * 100)} aria-label={`${h.name} weekly completion`} />
              </a>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

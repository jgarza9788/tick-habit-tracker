import { useState } from "react"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlameIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Stat } from "@/components/dashboard"
import { fmt, lifetimeRate, longestStreak, monthCells, streak, weeklyRates, type Habit } from "@/lib/habits"
import { tierFor } from "@/lib/streaks"
import { cn } from "@/lib/utils"

const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`)
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]

type Props = {
  habit: Habit
  today: Date
  onToggle: (habit: Habit, key: string, done: boolean, origin: { x: number; y: number }) => void
  onNote: (habit: Habit, note: string) => void
}

/** Everything about one habit on its own page: stats, a month calendar you can tick, weekly trend and notes. */
export function HabitDetail({ habit, today, onToggle, onNote }: Props) {
  const todayKey = fmt(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [note, setNote] = useState(habit.note ?? "")
  const s = streak(habit, today)
  const tier = tierFor(s)
  const total = Object.keys(habit.days).length
  const weeks = weeklyRates(habit, today, 12)
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const cells = monthCells(month.getFullYear(), month.getMonth())

  return (
    <div className="pane-in flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="lg" className="h-11 w-fit px-4 text-base" render={<a href="#/" />}>
          <ChevronLeftIcon data-icon="inline-start" className="size-5" />
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex min-w-0 items-center gap-2 text-3xl font-semibold tracking-tight">
            {habit.emoji && <span aria-hidden="true">{habit.emoji}</span>}
            <span className="truncate">{habit.name}</span>
          </h1>
          {habit.archived && <Badge variant="outline">Archived</Badge>}
          {s > 0 && (
            <Badge variant="outline" className="streak-badge" data-tier={tier.id} title={`${s}-day streak · ${tier.name}`}>
              <FlameIcon data-icon="inline-start" />
              {s}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Since {new Date(habit.createdAt + "T00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat index={0} title="Current streak" value={`${s}d`} hint={s ? tier.name : "Tick today to start"} />
        <Stat index={1} title="Longest streak" value={`${longestStreak(habit)}d`} hint="all time" />
        <Stat index={2} title="Total ticks" value={total} hint="all time" />
        <Stat index={3} title="Completion" value={pct(lifetimeRate(habit, today))} hint="since the start" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle aria-live="polite">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next month" disabled={isCurrentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
            <CardDescription>Tap a day to tick or untick it.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="pb-1 text-[11px] font-medium text-muted-foreground" aria-hidden="true">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />
                const key = fmt(d)
                const done = !!habit.days[key]
                const future = key > todayKey
                const label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={future}
                    aria-pressed={done}
                    aria-label={`${habit.name}, ${label}${future ? ", upcoming" : done ? ", done" : ", not done"}`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      onToggle(habit, key, !done, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
                    }}
                    className={cn(
                      "press mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                      done && "bg-primary font-medium text-primary-foreground",
                      !done && !future && "bg-muted text-muted-foreground",
                      future && "border border-dashed border-border text-muted-foreground",
                      !done && key === todayKey && "ring-2 ring-primary"
                    )}
                  >
                    {done ? <CheckIcon className="size-4" strokeWidth={3} /> : d.getDate()}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Last 12 weeks</CardTitle>
              <CardDescription>Completion per week</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="img"
                aria-label={`Weekly completion, oldest to newest: ${weeks.map((w) => pct(w.rate)).join(", ")}`}
                className="flex h-32 items-end gap-1.5"
              >
                {weeks.map((w) => (
                  <div
                    key={fmt(w.start)}
                    className="flex h-full flex-1 flex-col justify-end"
                    title={`Week of ${w.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${pct(w.rate)}`}
                  >
                    <div className="rounded-t-sm bg-primary" style={{ height: `${w.rate ? Math.max(w.rate * 100, 3) : 0}%` }} />
                    <div className="h-0.5 rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Why this habit matters, cues, what's working.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                aria-label={`Notes for ${habit.name}`}
                value={note}
                maxLength={500}
                rows={4}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note.trim() !== (habit.note ?? "") && onNote(habit, note.trim())}
                placeholder="Add a note…"
                className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{note.length}/500</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

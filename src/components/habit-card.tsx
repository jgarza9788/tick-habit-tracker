import { useState } from "react"
import { ArchiveIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, FlameIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GrowProgress } from "@/components/motion"
import { nextMilestone, prevMilestone, tierFor, type TierId } from "@/lib/streaks"
import { cn } from "@/lib/utils"
import { fmt, streak, type Habit } from "@/lib/habits"

export type Slide = { id: number; dir: "next" | "prev" | null }

type Props = {
  habit: Habit
  days: Date[]
  today: Date
  index: number
  slide: Slide
  leaving: boolean
  onToggle: (habit: Habit, key: string, done: boolean, origin: { x: number; y: number }) => void
  onRename: (habit: Habit) => void
  onDelete: (habit: Habit) => void
  onArchive: (habit: Habit) => void
  /** Move one place up (-1) or down (1) among the visible habits. */
  onMove: (habit: Habit, dir: -1 | 1) => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export function HabitCard({ habit, days, today, index, slide, leaving, onToggle, onRename, onDelete, onArchive, onMove, canMoveUp, canMoveDown }: Props) {
  const todayKey = fmt(today)
  const s = streak(habit, today)
  const tier = tierFor(s)
  const doneToday = !!habit.days[todayKey]
  // The day the user just ticked: only that check pops (not every check on page load / week change).
  const [popped, setPopped] = useState<string | null>(null)
  // One-shot glow (fades in 600ms) when a tick extends the streak; re-keyed so each extension replays it.
  const [flash, setFlash] = useState<{ id: number; tier: TierId } | null>(null)

  return (
    // Collapses smoothly when the habit is deleted.
    <div className="row-collapse" data-leaving={leaving}>
      <div className="-mx-2 min-h-0 overflow-hidden px-2">
        <div className="pb-3">
          <Card size="sm" className="streak-card relative rise-in" data-tier={tier.id} style={{ "--i": index } as React.CSSProperties}>
            {flash && (
              <span key={flash.id} className="streak-flash" data-tier={flash.tier} aria-hidden="true" onAnimationEnd={() => setFlash(null)} />
            )}
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                {habit.emoji && <span aria-hidden="true">{habit.emoji}</span>}
                <span className="truncate">{habit.name}</span>
                {s > 0 && (
                  // Remounts (and pops) whenever the streak changes.
                  <Badge
                    key={s}
                    variant="outline"
                    className="streak-badge tick-pop"
                    data-tier={tier.id}
                    data-risk={!doneToday}
                    title={`${s}-day streak · ${tier.name}`}
                  >
                    <FlameIcon data-icon="inline-start" />
                    {s}
                  </Badge>
                )}
              </CardTitle>
              <CardAction className="flex items-center">
                {/* Keyboard / screen-reader reordering. Mouse and touch users press-and-hold and drag instead. */}
                {(canMoveUp || canMoveDown) && (
                  <>
                    <Button variant="ghost" size="icon-sm" className="sr-only focus-visible:not-sr-only" aria-label={`Move ${habit.name} up`} disabled={!canMoveUp} onClick={() => onMove(habit, -1)}>
                      <ChevronUpIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="sr-only focus-visible:not-sr-only" aria-label={`Move ${habit.name} down`} disabled={!canMoveDown} onClick={() => onMove(habit, 1)}>
                      <ChevronDownIcon />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" aria-label={`Rename ${habit.name}`} onClick={() => onRename(habit)}>
                  <PencilIcon />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Archive ${habit.name}`} title="Archive (keeps history)" onClick={() => onArchive(habit)}>
                  <ArchiveIcon />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${habit.name}`} onClick={() => onDelete(habit)}>
                  <Trash2Icon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {/* Re-keyed per week so the days slide in from the direction you paged. */}
              <div
                key={slide.id}
                className={cn("grid gap-1", slide.dir === "next" && "slide-next", slide.dir === "prev" && "slide-prev")}
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {days.map((d) => {
                  const key = fmt(d)
                  const done = !!habit.days[key]
                  const isToday = key === todayKey
                  const future = key > todayKey
                  const justTicked = done && popped === key
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
                        setPopped(done ? null : key)
                        if (!done) {
                          const extended = streak({ ...habit, days: { ...habit.days, [key]: true as const } }, today)
                          if (extended > s) setFlash({ id: Date.now(), tier: tierFor(extended).id })
                        }
                        onToggle(habit, key, !done, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
                      }}
                      className="press flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "text-[11px] font-medium tracking-wide uppercase transition-colors",
                          isToday ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {d.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      <span
                        className={cn(
                          "grid size-10 place-items-center rounded-full text-sm font-medium transition-[background-color,box-shadow,color] duration-300",
                          done && "bg-primary text-primary-foreground",
                          !done && !future && "bg-muted text-muted-foreground",
                          !done && isToday && "ring-2 ring-primary",
                          future && "border border-dashed border-border text-muted-foreground",
                          justTicked && "circle-pop"
                        )}
                      >
                        {done ? (
                          <CheckIcon className={cn("size-5", justTicked && "tick-pop")} strokeWidth={3} />
                        ) : (
                          d.getDate()
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              <StreakHint streak={s} doneToday={doneToday} name={habit.name} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Motivation line + progress toward the next milestone (or a nudge when the streak is at risk). */
function StreakHint({ streak: s, doneToday, name }: { streak: number; doneToday: boolean; name: string }) {
  if (s === 0) return <p className="px-1 pt-1 text-xs text-muted-foreground">Tick today to start a streak.</p>
  const next = nextMilestone(s)
  const prev = prevMilestone(s)
  const left = next ? next - s : 0
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-1">
      <p className="text-xs text-muted-foreground">
        {!doneToday
          ? `Tick today to keep your ${s}-day streak alive.`
          : next
            ? `${left} more day${left === 1 ? "" : "s"} to a ${next}-day streak.`
            : "Legendary. Keep it going!"}
      </p>
      {next && (
        <GrowProgress
          value={Math.round(((s - prev) / (next - prev)) * 100)}
          aria-label={`${name}: progress to a ${next}-day streak`}
        />
      )}
    </div>
  )
}

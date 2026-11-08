import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, MoonIcon, PlusIcon, SunIcon } from "lucide-react"
import { toast } from "sonner"

import { AccentPicker } from "@/components/accent-picker"
import { AddHabitDialog } from "@/components/add-habit-dialog"
import { Dashboard } from "@/components/dashboard"
import { HabitCard, type Slide } from "@/components/habit-card"
import { Logo } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { burst } from "@/components/burst"
import { celebrate } from "@/components/celebrate"
import { api, auth } from "@/lib/api"
import { addDays, fmt, startOfDay, startOfWeek, streak, type Habit } from "@/lib/habits"
import { MILESTONE_COPY, MILESTONES } from "@/lib/streaks"
import { cn } from "@/lib/utils"

type View = "today" | "dashboard"

/** Current local day; re-evaluates at midnight and when the tab regains focus. */
function useToday() {
  const [today, setToday] = useState(() => startOfDay(new Date()))
  useEffect(() => {
    const check = () => setToday((t) => (fmt(t) === fmt(new Date()) ? t : startOfDay(new Date())))
    const id = setInterval(check, 30_000)
    document.addEventListener("visibilitychange", check)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", check)
    }
  }, [])
  return today
}

const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })

export function App({ username, onLogout }: { username: string; onLogout: () => void }) {
  const today = useToday()
  const { setTheme } = useTheme()
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(0)
  const [slide, setSlide] = useState<Slide>({ id: 0, dir: null })
  const [leaving, setLeaving] = useState<string | null>(null)
  const [view, setView] = useState<View>("today")
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  const load = useCallback(() => {
    setLoadError(false)
    api.list().then(setHabits).catch(() => setLoadError(true))
  }, [])
  useEffect(() => {
    api.list().then(setHabits).catch(() => setLoadError(true))
  }, [])

  // One Monday-based week at a time; `page` pages through weeks (0 = this week).
  const days = useMemo(() => {
    const start = startOfWeek(addDays(today, page * 7))
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [page, today])

  const setDay = (id: string, key: string, done: boolean) =>
    setHabits((hs) =>
      hs?.map((h) => {
        if (h.id !== id) return h
        const next = { ...h.days }
        if (done) next[key] = true
        else delete next[key]
        return { ...h, days: next }
      }) ?? null
    )

  const toggle = (h: Habit, key: string, done: boolean, origin: { x: number; y: number }) => {
    if (done) {
      // Reward: sparkle on every tick; full-screen celebration + toast when the streak crosses a milestone.
      const next = { ...h, days: { ...h.days, [key]: true as const } }
      const before = streak(h, today)
      const after = streak(next, today)
      // Highest milestone crossed (a backfilled day can jump the streak past one). Re-ticking replays it.
      const m = MILESTONES.filter((x) => x > before && x <= after).at(-1)
      if (m !== undefined) {
        const level = MILESTONES.indexOf(m)
        // Everything scales with the milestone: confetti from the button, the full-screen effect, the vibration.
        burst(origin.x, origin.y, { count: 20 + level * 9, power: 1 + level * 0.09 })
        celebrate(m)
        const copy = MILESTONE_COPY[m]
        toast(copy.title, { description: `${h.name}: ${copy.body}` })
        navigator.vibrate?.([20, 40, 20, ...Array.from({ length: level }, () => [30, 40]).flat(), 60])
      } else {
        burst(origin.x, origin.y, { count: after > before ? 14 : 8 })
        navigator.vibrate?.(10)
      }
    }
    setDay(h.id, key, done) // optimistic
    api.setDay(h.id, key, done).catch((e: Error) => {
      // Don't guess the old state (the user may have toggled again meanwhile): reload the truth from the server.
      toast.error("Couldn't save that tick", { description: e.message })
      load()
    })
  }

  const add = (name: string) =>
    api
      .create(name, fmt(today))
      .then((h) => setHabits((hs) => [...(hs ?? []), h]))
      .catch((e: Error) => toast.error("Couldn't add habit", { description: e.message }))

  // Collapse the card first, then drop it from state once the animation has finished.
  const remove = (h: Habit) => {
    setDeleting(null)
    setLeaving(h.id)
    setTimeout(() => {
      setHabits((hs) => hs?.filter((x) => x.id !== h.id) ?? null)
      setLeaving((l) => (l === h.id ? null : l))
    }, 450)
    api.remove(h.id).catch((e: Error) => {
      toast.error("Couldn't delete habit", { description: e.message })
      load()
      setLeaving(null)
    })
  }

  // Page weeks; the days slide in from the direction of travel.
  const go = (delta: number) => {
    setPage((p) => p + delta)
    setSlide((s) => ({ id: s.id + 1, dir: delta > 0 ? "next" : "prev" }))
  }
  const jumpToToday = () => {
    setSlide((s) => ({ id: s.id + 1, dir: page > 0 ? "prev" : "next" }))
    setPage(0)
  }

  const toggleTheme = () =>
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")

  const rangeLabel = `${short(days[0])} – ${short(days[days.length - 1])}`

  return (
    <div id="app-shell" className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Logo className="size-9 text-primary" />
          <span className="text-xl font-semibold tracking-tight">Tick</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => auth.logout().finally(onLogout)}
            aria-label={`Sign out ${username}`}
            title={`Sign out (${username})`}
          >
            <LogOutIcon />
          </Button>
          <AccentPicker />
          <Button variant="ghost" size="icon-lg" onClick={toggleTheme} aria-label="Toggle dark mode">
            <MoonIcon className="dark:hidden" />
            <SunIcon className="hidden dark:block" />
          </Button>
          <Button size="lg" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            Add habit
          </Button>
        </div>
      </header>

      {habits === null ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{loadError ? "Can't reach the server" : "Loading…"}</EmptyTitle>
            {loadError && <EmptyDescription>Check that the Tick server is running.</EmptyDescription>}
          </EmptyHeader>
          {loadError && (
            <EmptyContent>
              <Button variant="outline" onClick={load}>
                Try again
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : habits.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Logo className="size-14 text-primary" />
            </EmptyMedia>
            <EmptyTitle>Nothing to tick yet</EmptyTitle>
            <EmptyDescription>Add your first habit and start a streak.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" />
              Add habit
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {/* Phone: switch between the two panes. Desktop: both are always visible. */}
          <ToggleGroup
            variant="outline"
            className="w-full lg:hidden"
            value={[view]}
            onValueChange={(v) => v[0] && setView(v[0] as View)}
          >
            <ToggleGroupItem value="today" className="h-10 flex-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary">
              Habits
            </ToggleGroupItem>
            <ToggleGroupItem value="dashboard" className="h-10 flex-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary">
              Dashboard
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={cn("pane-in flex flex-col gap-4", view !== "today" && "max-lg:hidden")} aria-label="Habits">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
                <p className="text-muted-foreground">
                  {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span key={page} className="pane-in text-sm font-medium tabular-nums" aria-live="polite">
                  {page === 0 ? "This week" : rangeLabel}
                  {page === 0 && <span className="ml-2 font-normal text-muted-foreground">{rangeLabel}</span>}
                </span>
                <div className="flex items-center gap-1">
                  {page !== 0 && (
                    <Button variant="ghost" size="sm" onClick={jumpToToday}>
                      Today
                    </Button>
                  )}
                  <Button variant="outline" size="icon" aria-label="Previous" onClick={() => go(-1)}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Next" onClick={() => go(1)}>
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col">
                {habits.map((h, i) => (
                  <HabitCard key={h.id} habit={h} days={days} today={today} index={i} slide={slide} leaving={leaving === h.id} onToggle={toggle} onDelete={setDeleting} />
                ))}
              </div>
            </section>

            <section className={cn("pane-in", view !== "dashboard" && "max-lg:hidden")} aria-label="Dashboard">
              <h2 className="mb-4 text-3xl font-semibold tracking-tight max-lg:hidden">Dashboard</h2>
              {/* Keyed by the phone tab so opening Dashboard replays its count-up and grow animations. */}
              <Dashboard key={view} habits={habits} today={today} />
            </section>
          </div>
        </>
      )}

      <AddHabitDialog open={adding} onOpenChange={setAdding} onAdd={add} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This removes the habit and all of its history. It can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && remove(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default App

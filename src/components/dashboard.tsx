import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Heatmap } from "@/components/heatmap"
import { AnimatedNumber, GrowProgress } from "@/components/motion"
import { tierFor } from "@/lib/streaks"
import { fmt, lastDays, rate, streak, type Habit } from "@/lib/habits"

const chartConfig = { done: { label: "Completed", color: "var(--primary)" } } satisfies ChartConfig

const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`)

function Stat({ title, value, hint, index }: { title: string; value: React.ReactNode; hint: string; index: number }) {
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

  // Short chart: label every integer when there are few habits, else just 0 / middle / max.
  const yMax = Math.max(habits.length, 1)
  const yTicks = yMax <= 4 ? Array.from({ length: yMax + 1 }, (_, i) => i) : [0, Math.ceil(yMax / 2), yMax]

  const series = lastDays(today, 14).map((d) => {
    const key = fmt(d)
    return {
      label: String(d.getDate()),
      done: habits.filter((h) => h.days[key]).length,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat index={0} title="Today" value={<AnimatedNumber value={doneToday} format={(n) => `${n}/${habits.length}`} />} hint={doneToday === habits.length && habits.length ? "All done 🎉" : "habits completed"} />
        <Stat index={1} title="Best streak" value={best.n ? <AnimatedNumber value={best.n} format={(n) => `${n}d`} /> : "–"} hint={best.n ? `${tierFor(best.n).name} · ${best.name}` : "Start one today"} />
        <Stat index={2} title="Last 7 days" value={weekRate === null ? "–" : <AnimatedNumber value={Math.round(weekRate * 100)} format={(n) => `${n}%`} />} hint="completion rate" />
        <Stat index={3} title="Total ticks" value={<AnimatedNumber value={totalTicks} />} hint="all time" />
      </div>

      <Card className="rise-in" style={{ "--i": 4 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
          <CardDescription>Habits completed per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-28 w-full">
            <BarChart data={series} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tickMargin={6} fontSize={11} />
              <YAxis allowDecimals={false} domain={[0, yMax]} ticks={yTicks} interval={0} tickLine={false} axisLine={false} width={40} fontSize={11} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="done" fill="var(--color-done)" radius={6} animationDuration={1650} animationEasing="ease-out" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Heatmap habits={habits} today={today} className="rise-in" style={{ "--i": 5 } as React.CSSProperties} />

      <Card className="rise-in" style={{ "--i": 6 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>This week by habit</CardTitle>
          <CardDescription>Completion over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {habits.map((h) => {
            const r = rate([h], week)
            const done = week.filter((d) => h.days[fmt(d)]).length
            return (
              <div key={h.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    {h.emoji} {h.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{done}/7 · {pct(r)}</span>
                </div>
                <GrowProgress value={Math.round((r ?? 0) * 100)} aria-label={`${h.name} weekly completion`} />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

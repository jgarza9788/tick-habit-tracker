import { useEffect, useRef, useState } from "react"

import { Progress } from "@/components/ui/progress"

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Critically damped spring step response (no overshoot): fast start, soft settle. */
const settle = (t: number) => 1 - (1 + 9 * t) * Math.exp(-9 * t)

/** Counts to `value`, always starting from whatever is currently on screen (so it's interruptible). */
export function AnimatedNumber({
  value,
  format = String,
  ms = 900,
}: {
  value: number
  format?: (n: number) => string
  ms?: number
}) {
  const [shown, setShown] = useState(0)
  const live = useRef(0) // the presentation value

  useEffect(() => {
    if (reduced()) return // rendered directly from `value` below, no animation
    const from = live.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1)
      live.current = from + (value - from) * settle(t)
      setShown(live.current)
      if (t < 1) raf = requestAnimationFrame(tick)
      else live.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])

  return <>{format(Math.round(reduced() ? value : shown))}</>
}

/** Progress bar that grows from 0 on mount and eases between values after. */
export function GrowProgress({ value, ...props }: { value: number } & Omit<React.ComponentProps<typeof Progress>, "value">) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return <Progress value={v} {...props} />
}

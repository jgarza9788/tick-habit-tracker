import { useCallback, useEffect, useRef, useState } from "react"

const HOLD_MS = 350 // how long to press before the card lifts
const SLOP = 8 // px of movement during the hold that cancels it (it's a scroll or a click-drag, not a reorder)
const EDGE = 90 // px from the top/bottom of the screen where dragging auto-scrolls

type Drag = { id: string; from: number; over: number; dy: number; step: number }

/**
 * Press and hold a `[data-habit-id]` item, then drag it to a new place. Works with mouse, touch and pen via pointer
 * events; no dependency. Spread `onPointerDown` on the list container and give each child `data-habit-id`.
 * `itemState(id, index)` returns the transform to apply to each child while a drag is in progress.
 */
export function useLongPressReorder(ids: string[], onMove: (id: string, toIndex: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const idsRef = useRef(ids)
  const onMoveRef = useRef(onMove)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    idsRef.current = ids
    onMoveRef.current = onMove
  })
  useEffect(() => () => cancelRef.current?.(), [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || idsRef.current.length < 2) return
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-habit-id]")
    const id = el?.dataset.habitId
    if (!el || !id) return
    const container = e.currentTarget
    const from = idsRef.current.indexOf(id)
    if (from < 0) return

    const startX = e.clientX
    const startY = e.clientY
    const startScroll = window.scrollY
    let lastY = startY
    let active = false
    let raf = 0
    let tops: number[] = []
    let heights: number[] = []
    let step = 0
    let over = from

    const compute = () => {
      const dy = lastY - startY + (window.scrollY - startScroll)
      const center = tops[from] + heights[from] / 2 + dy
      over = from
      for (let i = 0; i < tops.length; i++) {
        const mid = tops[i] + heights[i] / 2
        if (i < from && center < mid) over = Math.min(over, i)
        if (i > from && center > mid) over = Math.max(over, i)
      }
      setDrag({ id, from, over, dy, step })
    }

    const loop = () => {
      if (lastY < EDGE) window.scrollBy(0, -12)
      else if (lastY > window.innerHeight - EDGE) window.scrollBy(0, 12)
      compute()
      raf = requestAnimationFrame(loop)
    }

    const activate = () => {
      const items = [...container.querySelectorAll<HTMLElement>("[data-habit-id]")]
      if (items.length !== idsRef.current.length) return cleanup()
      const rects = items.map((n) => n.getBoundingClientRect())
      tops = rects.map((r) => r.top + window.scrollY)
      heights = rects.map((r) => r.height)
      step = heights[from] + (rects.length > 1 ? rects[1].top - rects[0].bottom : 0)
      active = true
      document.body.classList.add("dragging-card")
      navigator.vibrate?.(15)
      loop()
    }

    const onMovePointer = (ev: PointerEvent) => {
      lastY = ev.clientY
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) > SLOP) cleanup()
    }
    const onEnd = () => {
      const wasActive = active
      const target = over
      cleanup()
      if (!wasActive) return
      // The pointerup would otherwise "click" whatever is under the finger (e.g. toggle a day).
      const swallow = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener("click", swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener("click", swallow, true), 100)
      if (target !== from) onMoveRef.current(id, target)
    }
    // Touch: once the card has lifted, stop the page from scrolling under the finger. (Auto-scroll handles long lists.)
    const onTouchMove = (ev: TouchEvent) => {
      if (active && ev.cancelable) ev.preventDefault()
    }
    const onContextMenu = (ev: Event) => ev.preventDefault() // long-press menu on touch / right-click

    const timer = window.setTimeout(activate, HOLD_MS)
    window.addEventListener("pointermove", onMovePointer)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("contextmenu", onContextMenu)

    function cleanup() {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMovePointer)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
      window.removeEventListener("touchmove", onTouchMove)
      // Keep swallowing the long-press context menu a moment longer: touch browsers fire it after release.
      setTimeout(() => window.removeEventListener("contextmenu", onContextMenu), 600)
      document.body.classList.remove("dragging-card")
      cancelRef.current = null
      setDrag(null)
    }
    cancelRef.current = cleanup
  }, [])

  /** Per-item look while dragging: the held item follows the pointer, the others slide to make room. */
  const itemState = (id: string, index: number) => {
    if (!drag) return { dragging: false, style: undefined }
    if (drag.id === id)
      return {
        dragging: true,
        style: { transform: `translateY(${drag.dy}px) scale(1.02)`, zIndex: 30, position: "relative", transition: "none" } as React.CSSProperties,
      }
    let shift = 0
    if (drag.from < drag.over && index > drag.from && index <= drag.over) shift = -drag.step
    if (drag.from > drag.over && index >= drag.over && index < drag.from) shift = drag.step
    return {
      dragging: false,
      style: { transform: shift ? `translateY(${shift}px)` : undefined, transition: "transform 200ms ease" } as React.CSSProperties,
    }
  }

  return { onPointerDown, itemState, dragging: drag !== null }
}

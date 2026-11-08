/** Dependency-free confetti/sparkle burst (Web Animations API). Skipped for reduced motion. */
const COLORS = ["#3ddc84", "#ffd24a", "#ff9f43", "#ff6b9d", "#7c8cff", "#ffffff"]

export function burst(x: number, y: number, { count = 10, power = 1 }: { count?: number; power?: number } = {}) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const layer = document.createElement("div")
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden"
  document.body.append(layer)

  const duration = 900 + power * 500
  const gravity = 1100
  let remaining = count

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span")
    const size = 5 + Math.random() * 6
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.5)}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${COLORS[i % COLORS.length]}`
    layer.append(el)

    const angle = Math.random() * Math.PI * 2
    const speed = (140 + Math.random() * 240) * power
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed - 160 * power // bias upward
    const spin = (Math.random() - 0.5) * 900

    const frames: Keyframe[] = []
    const steps = 16
    for (let s = 0; s <= steps; s++) {
      const p = s / steps
      const t = (p * duration) / 1000
      frames.push({
        transform: `translate(${vx * t}px, ${vy * t + 0.5 * gravity * t * t}px) rotate(${spin * t}deg) scale(${1 - p * 0.4})`,
        opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      })
    }
    el.animate(frames, { duration, easing: "linear", fill: "forwards" }).onfinish = () => {
      if (--remaining === 0) layer.remove()
    }
  }
}

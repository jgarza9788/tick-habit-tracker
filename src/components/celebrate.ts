/** Quick full-screen milestone celebration: tinted flash, big emoji + number, confetti rain. Skipped for reduced motion. */
const EMOJI: Record<number, string> = { 3: "🔥", 7: "🔥", 14: "💪", 30: "👑", 60: "🚀", 100: "🏆" }
const COLORS = ["#3ddc84", "#ffd24a", "#ff9f43", "#ff6b9d", "#7c8cff", "#ffffff"]

function el(tag: string, css: string, text?: string) {
  const e = document.createElement(tag)
  e.style.cssText = css
  if (text) e.textContent = text
  return e
}

export function celebrate(n: number, tint: string) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const layer = el("div", "position:fixed;inset:0;pointer-events:none;z-index:101;overflow:hidden")
  document.body.append(layer)

  // 1. Tinted flash that blooms from the center and fades.
  const flash = el(
    "div",
    `position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% 42%, ${tint}66 0%, ${tint}2b 38%, transparent 72%)`
  )
  layer.append(flash)
  flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 0 }], { duration: 1100, easing: "ease-out", fill: "forwards" })

  // 2. Big emoji + streak number, springing in then drifting away.
  const shadow = "text-shadow:0 2px 20px rgba(0,0,0,.45)"
  const mid = el("div", "position:absolute;left:50%;top:42%;text-align:center;color:#fff;font-family:inherit;opacity:0;padding:44px 64px;border-radius:50%;background:radial-gradient(closest-side, rgba(0,0,0,.42), rgba(0,0,0,.2) 62%, transparent)")
  mid.append(
    el("div", `font-size:104px;line-height:1;${shadow}`, EMOJI[n] ?? "🔥"),
    el("div", `font-size:60px;line-height:1.1;font-weight:800;letter-spacing:-0.03em;${shadow}`, String(n)),
    el("div", `font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.92;${shadow}`, "day streak")
  )
  layer.append(mid)
  mid.animate(
    [
      { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.14)", opacity: 1, offset: 0.26 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.72 },
      { transform: "translate(-50%,-60%) scale(1.05)", opacity: 0 },
    ],
    { duration: 1600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
  )

  // 3. Confetti raining from the top edge.
  const w = window.innerWidth
  const h = window.innerHeight
  for (let i = 0; i < 90; i++) {
    const size = 6 + Math.random() * 7
    const p = el(
      "span",
      `position:absolute;left:${Math.random() * w}px;top:-24px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.5)}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${COLORS[i % COLORS.length]}`
    )
    layer.append(p)
    const sway = (Math.random() - 0.5) * 160
    const spin = (Math.random() - 0.5) * 1080
    const duration = 1400 + Math.random() * 900
    const frames: Keyframe[] = []
    for (let s = 0; s <= 12; s++) {
      const t = s / 12
      frames.push({
        transform: `translate(${sway * Math.sin(t * Math.PI * 2.2)}px, ${t * (h + 60)}px) rotate(${spin * t}deg)`,
        opacity: t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15,
      })
    }
    p.animate(frames, { duration, delay: Math.random() * 450, easing: "cubic-bezier(.3,.1,.6,1)", fill: "both" })
  }

  setTimeout(() => layer.remove(), 3000)
}

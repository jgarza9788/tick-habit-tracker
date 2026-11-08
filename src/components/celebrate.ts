/**
 * Full-screen milestone celebrations. Each level has its own theme, and every dimension grows with the streak:
 * length, backdrop strength, title size and particle count.
 *
 *   3 sparkles · 7 fire · 14 power · 30 royal · 60 rocket/warp · 100 / 150 / 200 fireworks · 365 one-year
 *
 * Everything is sized from the viewport (`fit`) and particle counts from the screen area (`density`), so it looks
 * right from a 320px phone to a 1440p monitor. Skipped for reduced motion. All of it lives in one overlay that is
 * removed once every animation has finished, and every glow ends fully transparent, so nothing lingers.
 */
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v))

function el(tag: string, css: string, text?: string) {
  const e = document.createElement(tag)
  e.style.cssText = css
  if (text) e.textContent = text
  return e
}

const SHADOW = "text-shadow:0 2px 24px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.45)"
const GOLD = ["#ffd24a", "#f6c453", "#fff2b0", "#ffffff"]
const CONFETTI = ["#3ddc84", "#ffd24a", "#ff9f43", "#ff6b9d", "#7c8cff", "#ffffff"]

/** Frames for a particle thrown with velocity (vx, vy) px/s under gravity g, shrinking and fading out. */
function ballistic(vx: number, vy: number, g: number, dur: number, spin = 0, steps = 16): Keyframe[] {
  const frames: Keyframe[] = []
  for (let s = 0; s <= steps; s++) {
    const p = s / steps
    const t = (p * dur) / 1000
    frames.push({
      transform: `translate(${vx * t}px, ${vy * t + 0.5 * g * t * t}px) rotate(${spin * t}deg) scale(${1 - p * 0.45})`,
      opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
    })
  }
  return frames
}

class Stage {
  layer = el("div", "position:fixed;inset:0;pointer-events:none;z-index:101;overflow:hidden")
  anims: Animation[] = []
  w = window.innerWidth
  h = window.innerHeight
  cx = this.w / 2
  cy = this.h * 0.42
  /** Size multiplier from the viewport: small phones and short landscape screens get smaller visuals. */
  fit = clamp(0.55, Math.min(this.w / 760, this.h / 620), 1.6)
  /** Particle-count multiplier from screen area: fewer on phones, more on big monitors. */
  density = clamp(0.6, (this.w * this.h) / (1280 * 800), 1.6)

  constructor() {
    document.body.append(this.layer)
  }

  count(n: number) {
    return Math.max(4, Math.round(n * this.density))
  }

  /** Add an element and animate it. fill:"both" holds the first frame during the delay and the last frame after. */
  add(css: string, frames: Keyframe[], opts: KeyframeAnimationOptions, text?: string) {
    return this.raw(el("div", css, text), frames, opts)
  }

  /**
   * Elements that start later are created just in time instead of up front. That spreads the setup cost (no hitch
   * on tap) and stops delayed elements from sitting visible at their start position before their turn.
   */
  raw(node: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
    const delay = Number(opts.delay ?? 0)
    if (delay > 150) {
      const id = window.setTimeout(() => {
        this.timers.delete(id)
        this.mount(node, frames, { ...opts, delay: 0 })
      }, delay)
      this.timers.add(id)
      return node
    }
    return this.mount(node, frames, opts)
  }

  private timers = new Set<number>()

  private mount(node: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
    this.layer.append(node)
    this.anims.push(node.animate(frames, { fill: "both", ...opts }))
    return node
  }

  /** Frosted, dimmed backdrop behind the title (dim to focus). Drawn first so everything else sits on top. */
  backdrop(blur: number, dim: number, ms: number) {
    const solid = window.matchMedia("(prefers-reduced-transparency: reduce)").matches
    const a = solid ? dim + 0.15 : dim
    const filter = solid ? "" : `backdrop-filter:blur(${blur}px) saturate(1.15);-webkit-backdrop-filter:blur(${blur}px) saturate(1.15);`
    this.add(
      `position:absolute;inset:0;${filter}background:radial-gradient(circle at 50% 42%, rgba(6,8,14,${a + 0.22}) 0, rgba(6,8,14,${a}) 45%, rgba(6,8,14,${a * 0.8}) 100%)`,
      [
        { opacity: 0, easing: "ease-out" },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.8, easing: "ease-in" },
        { opacity: 0 },
      ],
      // Linear overall: each segment eases itself. An overall easing would squeeze the hold and fade out early.
      { duration: ms, easing: "linear" }
    )
  }

  /** Radial color bloom from the center. Always ends at opacity 0. */
  glow(color: string, ms: number, peak = 1) {
    this.add(
      `position:absolute;inset:0;background:radial-gradient(circle at 50% 42%, ${color}66 0%, ${color}2b 38%, transparent 72%)`,
      [{ opacity: 0, easing: "ease-out" }, { opacity: peak, offset: 0.16, easing: "ease-in" }, { opacity: 0 }],
      { duration: ms, easing: "linear" }
    )
  }

  /** The big emoji + streak number + label, scaled to the screen. */
  title(n: number, emoji: string, size: number, ms: number, opts: { drop?: boolean; label?: string } = {}) {
    const e = Math.round(size * this.fit)
    const mid = el("div", `position:absolute;left:50%;top:42%;text-align:center;color:#fff;font-family:inherit;white-space:nowrap`)
    mid.append(
      el("div", `font-size:${e}px;line-height:1;${SHADOW}`, emoji),
      el("div", `font-size:${Math.round(e * 0.62)}px;line-height:1.05;font-weight:800;letter-spacing:-0.03em;${SHADOW}`, String(n)),
      el(
        "div",
        `font-size:${Math.max(11, Math.round(15 * this.fit))}px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.95;${SHADOW}`,
        opts.label ?? "day streak"
      )
    )
    const frames: Keyframe[] = opts.drop
      ? [
          { transform: "translate(-50%, calc(-50% - 75vh))", opacity: 0, easing: "ease-in" },
          { transform: "translate(-50%,-50%)", opacity: 1, offset: 0.26 },
          { transform: "translate(-50%,-56%)", offset: 0.34, easing: "ease-in" },
          { transform: "translate(-50%,-50%)", offset: 0.44 },
          { transform: "translate(-50%,-50%)", opacity: 1, offset: 0.8, easing: "ease-in" },
          { transform: "translate(-50%,-60%)", opacity: 0 },
        ]
      : [
          { transform: "translate(-50%,-50%) scale(.3)", opacity: 0, easing: "cubic-bezier(.2,.8,.2,1)" },
          { transform: "translate(-50%,-50%) scale(1.12)", opacity: 1, offset: 0.2, easing: "ease-in-out" },
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.32 },
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.8, easing: "ease-in" },
          { transform: "translate(-50%,-58%) scale(1.04)", opacity: 0 },
        ]
    // Linear overall; the keyframes carry their own easing (see backdrop()).
    this.raw(mid, frames, { duration: ms, easing: "linear" })
  }

  /** Radial burst of glowing particles from a point (fireworks). Glow is a gradient, not a box-shadow: much cheaper. */
  spray(x: number, y: number, count: number, colors: readonly string[], opts: { speed: number; duration: number; delay?: number; gravity?: number; size?: number }) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = opts.speed * rand(0.35, 1)
      const size = (opts.size ?? 6) * this.fit * rand(0.8, 1.4) * 1.8
      const color = pick(colors)
      this.add(
        `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:radial-gradient(circle, #fff 0 16%, ${color} 34%, transparent 70%)`,
        ballistic(Math.cos(angle) * speed, Math.sin(angle) * speed, opts.gravity ?? 600, opts.duration),
        { duration: opts.duration, delay: opts.delay ?? 0, easing: "linear" }
      )
    }
  }

  /** Confetti falling from the top edge. */
  rain(count: number, colors: readonly string[], opts: { min: number; max: number; delay: number }) {
    for (let i = 0; i < count; i++) {
      const size = rand(6, 12) * this.fit
      const sway = rand(-80, 80) * this.fit
      const spin = rand(-540, 540)
      const frames: Keyframe[] = []
      for (let s = 0; s <= 12; s++) {
        const t = s / 12
        frames.push({
          transform: `translate(${sway * Math.sin(t * Math.PI * 2.2)}px, ${t * (this.h + 60)}px) rotate(${spin * t}deg)`,
          opacity: t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15,
        })
      }
      this.add(
        `position:absolute;left:${rand(0, this.w)}px;top:-24px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.5)}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${pick(colors)}`,
        frames,
        { duration: rand(opts.min, opts.max), delay: rand(0, opts.delay), easing: "cubic-bezier(.3,.1,.6,1)" }
      )
    }
  }

  /** Emoji falling from the top edge (coins, sparkles…). */
  emojiRain(count: number, emojis: readonly string[], opts: { min: number; max: number; delay: number; size: [number, number] }) {
    for (let i = 0; i < count; i++) {
      const size = rand(...opts.size) * this.fit
      this.add(
        `position:absolute;left:${rand(0, this.w)}px;top:-40px;font-size:${size}px;line-height:1`,
        [
          { transform: "translateY(0) rotate(0deg)", opacity: 1 },
          { transform: `translateY(${this.h + 60}px) rotate(${rand(-300, 300)}deg)`, opacity: 1, offset: 0.9 },
          { transform: `translateY(${this.h + 80}px)`, opacity: 0 },
        ],
        { duration: rand(opts.min, opts.max), delay: rand(0, opts.delay), easing: "cubic-bezier(.3,.1,.6,1)" },
        pick(emojis)
      )
    }
  }

  /** Rotating rays of light behind the title. */
  rays(color: string, ms: number) {
    // Just big enough to reach the corners (smaller layer = cheaper to rotate than a fixed 150vmax square).
    const d = Math.hypot(this.w, this.h) * 1.15
    this.add(
      `position:absolute;left:${this.cx}px;top:${this.cy}px;width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;background:repeating-conic-gradient(from 0deg, ${color} 0 7deg, transparent 7deg 20deg);-webkit-mask-image:radial-gradient(circle, #000 0, transparent 60%);mask-image:radial-gradient(circle, #000 0, transparent 60%)`,
      [
        { opacity: 0, transform: "rotate(0deg) scale(.6)" },
        { opacity: 1, offset: 0.25 },
        { opacity: 0, transform: "rotate(40deg) scale(1.1)" },
      ],
      { duration: ms, easing: "ease-out" }
    )
  }

  /**
   * Shake the app shell. Not #root: the toast lives in #root and must stay put. Not part of the overlay, so it
   * reverts on its own and doesn't hold up cleanup.
   */
  shake(px: number, ms: number, delay = 0) {
    const p = px * this.fit
    document.getElementById("app-shell")?.animate(
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${-p}px, ${p * 0.6}px)` },
        { transform: `translate(${p}px, ${-p * 0.7}px)` },
        { transform: `translate(${-p * 0.6}px, ${-p * 0.4}px)` },
        { transform: `translate(${p * 0.4}px, ${p * 0.4}px)` },
        { transform: "translate(0,0)" },
      ],
      { duration: ms, delay, easing: "linear" }
    )
  }

  /** Remove the overlay once every element has been created and every animation has finished (hard cap as a safety net). */
  end() {
    const remove = () => this.layer.remove()
    const settle = async () => {
      while (this.timers.size) await new Promise((r) => setTimeout(r, 100))
      await Promise.all(this.anims.map((a) => a.finished.catch(() => undefined)))
    }
    void settle().then(remove)
    setTimeout(remove, 10000)
  }
}

/** 3 days (~1.6s): a gentle shower of twinkling stars. */
function sparkles(s: Stage) {
  const T = 1600
  s.backdrop(3, 0.2, T)
  s.glow("#ffd24a", 1300, 0.8)
  for (let i = 0; i < s.count(18); i++) {
    const size = rand(14, 30) * s.fit
    const a = rand(0, Math.PI * 2)
    const r = rand(60 * s.fit, Math.min(s.w, s.h) * 0.42)
    s.add(
      `position:absolute;left:${s.cx + Math.cos(a) * r}px;top:${s.cy + Math.sin(a) * r * 0.8}px;margin:${-size / 2}px 0 0 ${-size / 2}px;font-size:${size}px;line-height:1;color:${pick(GOLD)};text-shadow:0 0 10px currentColor`,
      [
        { transform: "scale(0) rotate(0deg)", opacity: 0 },
        { transform: `scale(1.2) rotate(${rand(60, 120)}deg)`, opacity: 1, offset: 0.45 },
        { transform: "scale(0) rotate(200deg)", opacity: 0 },
      ],
      { duration: rand(650, 1000), delay: rand(0, 550), easing: "ease-out" },
      "✦"
    )
  }
  s.title(3, "✨", 88, T)
}

/** 7 days (~2.2s): a wall of heat with embers and flames rising from the bottom. */
function fire(s: Stage) {
  const T = 2200
  s.backdrop(5, 0.26, T)
  s.add(
    "position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(to top, #ff6a0099, #ff6a0033 45%, transparent)",
    [
      { opacity: 0, transform: "translateY(30%)" },
      { opacity: 1, transform: "none", offset: 0.3 },
      { opacity: 0, transform: "translateY(-6%)" },
    ],
    { duration: T - 150, easing: "ease-out" }
  )
  for (let i = 0; i < s.count(45); i++) {
    const size = rand(6, 14) * s.fit
    const rise = s.h * rand(0.5, 1)
    const sway = rand(-60, 60) * s.fit
    s.add(
      `position:absolute;left:${rand(0, s.w)}px;top:${s.h + 10}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle, #fff2b0 0 15%, ${pick(["#ff9f43", "#ffd24a", "#ff6a00"])} 40%, transparent 70%)`,
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${sway}px, ${-rise * 0.6}px) scale(.8)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${sway * 1.4}px, ${-rise}px) scale(.2)`, opacity: 0 },
      ],
      { duration: rand(1000, 1600), delay: rand(0, 500), easing: "ease-out" }
    )
  }
  for (let i = 0; i < s.count(9); i++) {
    const size = rand(28, 56) * s.fit
    const rise = s.h * rand(0.45, 0.8)
    s.add(
      `position:absolute;left:${rand(0.05, 0.95) * s.w}px;top:${s.h}px;font-size:${size}px;line-height:1`,
      [
        { transform: "translateY(0) rotate(-8deg) scale(.6)", opacity: 0 },
        { transform: `translateY(${-rise * 0.4}px) rotate(8deg) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translateY(${-rise}px) rotate(-6deg) scale(.7)`, opacity: 0 },
      ],
      { duration: rand(1300, 1700), delay: rand(0, 450), easing: "ease-out" },
      "🔥"
    )
  }
  s.title(7, "🔥", 100, T)
}

/** 14 days (~2.7s): an impact. Two waves of shockwave rings and speed lines, and a screen shake. */
function power(s: Stage) {
  const T = 2700
  s.backdrop(6, 0.3, T)
  s.glow("#ff4d4d", 1500, 0.75)
  const ring = 120 * s.fit
  const grow = (Math.hypot(s.w, s.h) / ring) * 1.05
  const reach = Math.hypot(s.w, s.h) * 0.55
  for (const [wave, at] of [0, 650].entries()) {
    for (let i = 0; i < 3; i++) {
      s.add(
        `position:absolute;left:${s.cx}px;top:${s.cy}px;width:${ring}px;height:${ring}px;margin:${-ring / 2}px 0 0 ${-ring / 2}px;border-radius:50%;border:${Math.max(2, (6 - i) * s.fit)}px solid ${pick(["#ffffff", "#ff8a65", "#ff4d4d"])}`,
        [
          { transform: "scale(.2)", opacity: wave ? 0.7 : 0.95 },
          { transform: `scale(${grow})`, opacity: 0 },
        ],
        { duration: 1000 + i * 120, delay: at + i * 140, easing: "cubic-bezier(.1,.7,.2,1)" }
      )
    }
    for (let i = 0, n = s.count(20); i < n; i++) {
      const deg = (360 / n) * i + rand(-5, 5)
      const len = rand(70, 190) * s.fit
      s.add(
        `position:absolute;left:${s.cx}px;top:${s.cy}px;width:3px;height:${len}px;margin-left:-1.5px;transform-origin:0 0;border-radius:2px;background:linear-gradient(to top, transparent, ${pick(["#ffffff", "#ffb199", "#ff6b6b"])})`,
        [
          { transform: `rotate(${deg}deg) translateY(${-60 * s.fit}px)`, opacity: 1 },
          { transform: `rotate(${deg}deg) translateY(${-reach}px)`, opacity: 0 },
        ],
        { duration: rand(450, 750), delay: at + rand(0, 220), easing: "cubic-bezier(.2,.7,.3,1)" }
      )
    }
  }
  s.shake(8, 420)
  s.shake(4, 300, 650)
  s.title(14, "💪", 112, T)
}

/** 30 days (~3.2s): royalty. Rotating rays, a crown that drops in, and a golden shower. */
function royal(s: Stage) {
  const T = 3200
  s.backdrop(8, 0.34, T)
  s.glow("#f6c453", 2000, 0.9)
  s.rays("rgba(255,214,102,.5)", T - 150)
  s.rain(s.count(80), [...GOLD, "#ff6ba8"], { min: 1500, max: 2400, delay: 700 })
  s.emojiRain(s.count(14), ["🪙", "✨", "💛"], { min: 1700, max: 2500, delay: 650, size: [16, 28] })
  s.title(30, "👑", 124, T, { drop: true })
}

/** 60 days (~3.8s): warp speed. Stars streak past the screen and a rocket blasts across. */
function rocket(s: Stage) {
  const T = 3800
  s.add(
    "position:absolute;inset:0;background:radial-gradient(circle at 50% 42%, rgba(24,28,72,.6), rgba(6,8,28,.45))",
    [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }],
    { duration: T - 50 }
  )
  s.backdrop(8, 0.12, T - 50)
  s.glow("#6a7bff", 3000, 0.9)
  const reach = Math.hypot(s.w, s.h) * 0.62
  for (let i = 0; i < s.count(100); i++) {
    const deg = rand(0, 360)
    const len = rand(50, 170) * s.fit
    const near = rand(20, 120) * s.fit
    s.add(
      `position:absolute;left:${s.cx}px;top:${s.cy}px;width:${rand(1.5, 3.2)}px;height:${len}px;margin-left:-1px;transform-origin:0 0;border-radius:2px;background:linear-gradient(to top, transparent, ${pick(["#ffffff", "#cfe0ff", "#a9bcff", "#ffe9a8"])})`,
      [
        { transform: `rotate(${deg}deg) translateY(${-near}px) scaleY(.2)`, opacity: 0 },
        { transform: `rotate(${deg}deg) translateY(${-reach * 0.35}px) scaleY(.7)`, opacity: 1, offset: 0.25 },
        { transform: `rotate(${deg}deg) translateY(${-reach}px) scaleY(1.2)`, opacity: 0 },
      ],
      { duration: rand(550, 950), delay: rand(0, 2600), easing: "cubic-bezier(.5,0,.9,.6)" }
    )
  }
  // The rocket, with a flame trail, climbing from the bottom-left corner to the top-right.
  const size = 92 * s.fit
  const ship = el("div", `position:absolute;left:0;top:0;font-size:${size}px;line-height:1`)
  ship.append(
    el(
      "div",
      `position:absolute;right:46%;top:56%;width:${300 * s.fit}px;height:${16 * s.fit}px;transform-origin:100% 50%;transform:translateY(-50%) rotate(-45deg);border-radius:8px;background:linear-gradient(to right, transparent, rgba(255,150,60,.85) 62%, #fff);filter:blur(2px)`
    ),
    el("span", "position:relative;display:block", "🚀")
  )
  s.raw(
    ship,
    [
      { transform: `translate(${-s.w * 0.1}px, ${s.h * 1.05}px) scale(.7)`, opacity: 1 },
      { transform: `translate(${s.w * 0.55}px, ${s.h * 0.35}px) scale(1.2)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${s.w * 1.1}px, ${-s.h * 0.15 - size}px) scale(1.5)`, opacity: 1 },
    ],
    { duration: 1900, delay: 400, easing: "cubic-bezier(.45,.05,.75,.5)" }
  )
  s.shake(4, 500, 400)
  s.title(60, "🌠", 132, T)
}

const PALETTES = [
  ["#ff4d6d", "#ff8fa3", "#ffffff"],
  ["#4dabff", "#a5d8ff", "#ffffff"],
  ["#ffd24a", "#fff2b0", "#ff9f43"],
  ["#3ddc84", "#b2f2bb", "#ffffff"],
  ["#c77dff", "#e0aaff", "#ffffff"],
]
const GOLD_PALETTES = [
  ["#ffd24a", "#fff2b0", "#ffffff"],
  ["#f6c453", "#ffe08a", "#ff9f43"],
  ["#ff6ba8", "#ffd24a", "#ffffff"],
]

/** The fireworks finale, scaled per level: 100, 150, 200, and the one-year special at 365. */
const FINALE = {
  100: { T: 4600, bursts: 7, per: 40, confetti: 80, emoji: "🏆", size: 150, blur: 10, dim: 0.4, shake: 6, gold: false, label: "day streak" },
  150: { T: 5000, bursts: 8, per: 42, confetti: 90, emoji: "🌟", size: 156, blur: 10, dim: 0.42, shake: 6, gold: false, label: "day streak" },
  200: { T: 5400, bursts: 9, per: 44, confetti: 100, emoji: "💎", size: 162, blur: 10, dim: 0.44, shake: 7, gold: false, label: "day streak" },
  365: { T: 6000, bursts: 10, per: 46, confetti: 110, emoji: "👑🏆", size: 170, blur: 10, dim: 0.46, shake: 8, gold: true, label: "days · one year" },
} as const

function finale(s: Stage, n: number, level: keyof typeof FINALE) {
  const f = FINALE[level]
  const LAUNCH = 380
  const BURST = 1500
  const gap = (f.T - 300 - LAUNCH - BURST) / (f.bursts - 1)
  s.backdrop(f.blur, f.dim, f.T)
  s.glow("#ffd24a", f.T * 0.85, 0.85)
  if (f.gold) {
    s.rays("rgba(255,214,102,.45)", f.T - 150)
    s.emojiRain(s.count(16), ["🪙", "✨", "👑"], { min: 2000, max: 2800, delay: f.T - 3000, size: [18, 30] })
  }
  const palettes = f.gold ? GOLD_PALETTES : PALETTES
  const per = Math.round(f.per * clamp(0.75, s.density, 1))
  for (let i = 0; i < f.bursts; i++) {
    const x = s.w * rand(0.12, 0.88)
    const y = s.h * rand(0.1, 0.45)
    const t = i * gap
    const colors = palettes[i % palettes.length]
    // The shell streaking up to its burst point...
    s.add(
      `position:absolute;left:${x}px;top:${s.h}px;width:4px;height:${70 * s.fit}px;margin-left:-2px;border-radius:2px;background:linear-gradient(to top, transparent, #fff)`,
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${-(s.h - y)}px)`, opacity: 1, offset: 0.9 },
        { transform: `translateY(${-(s.h - y)}px)`, opacity: 0 },
      ],
      { duration: LAUNCH, delay: t, easing: "cubic-bezier(.2,.6,.4,1)" }
    )
    // ...then the burst and its flash.
    s.spray(x, y, per, colors, { speed: Math.min(s.w, s.h) * 0.85, duration: BURST, delay: t + LAUNCH, size: 8, gravity: 520 })
    const flash = 120 * s.fit
    s.add(
      `position:absolute;left:${x}px;top:${y}px;width:${flash}px;height:${flash}px;margin:${-flash / 2}px 0 0 ${-flash / 2}px;border-radius:50%;background:radial-gradient(circle, #fff, ${colors[0]}88 40%, transparent 70%)`,
      [
        { transform: "scale(.1)", opacity: 0 },
        { transform: "scale(1.4)", opacity: 1, offset: 0.2 },
        { transform: "scale(2.2)", opacity: 0 },
      ],
      { duration: 550, delay: t + LAUNCH, easing: "ease-out" }
    )
  }
  s.rain(Math.round(f.confetti * clamp(0.6, s.density, 1.15)), f.gold ? [...GOLD, "#ff6ba8"] : CONFETTI, { min: 1700, max: 2300, delay: f.T - 2500 })
  s.shake(f.shake, 320)
  s.title(n, f.emoji, f.size, f.T, { label: f.label })
}

/** Play the celebration for a streak milestone. Safe to call anywhere; does nothing for reduced motion. */
export function celebrate(n: number) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const s = new Stage()
  if (n >= 365) finale(s, n, 365)
  else if (n >= 200) finale(s, n, 200)
  else if (n >= 150) finale(s, n, 150)
  else if (n >= 100) finale(s, n, 100)
  else if (n >= 60) rocket(s)
  else if (n >= 30) royal(s)
  else if (n >= 14) power(s)
  else if (n >= 7) fire(s)
  else sparkles(s)
  s.end()
}

// Preview any level from the browser console: tickCelebrate(365)
if (typeof window !== "undefined") (window as unknown as { tickCelebrate: typeof celebrate }).tickCelebrate = celebrate

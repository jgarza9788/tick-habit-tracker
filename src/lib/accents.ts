/** Accent colors. The CSS for each lives in index.css under [data-accent="<id>"]; `swatch` is just for the picker. */
export const ACCENTS = [
  { id: "green", name: "Green", swatch: "oklch(0.62 0.17 150)" },
  { id: "teal", name: "Teal", swatch: "oklch(0.6 0.12 195)" },
  { id: "blue", name: "Blue", swatch: "oklch(0.58 0.19 255)" },
  { id: "violet", name: "Violet", swatch: "oklch(0.56 0.22 295)" },
  { id: "pink", name: "Pink", swatch: "oklch(0.62 0.22 355)" },
  { id: "orange", name: "Orange", swatch: "oklch(0.64 0.19 50)" },
  { id: "red", name: "Red", swatch: "oklch(0.58 0.22 25)" },
] as const

export type AccentId = (typeof ACCENTS)[number]["id"]

const KEY = "tick-accent"

export function currentAccent(): AccentId {
  const id = document.documentElement.dataset.accent
  return ACCENTS.some((a) => a.id === id) ? (id as AccentId) : "green"
}

export function applyAccent(id: AccentId) {
  document.documentElement.dataset.accent = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode etc.: the choice just won't persist */
  }
}

// Runs synchronously in <head> before first paint: apply the saved accent color and light/dark theme so a reload
// never flashes the defaults (e.g. white before dark mode kicks in).
try {
  var root = document.documentElement
  var accent = localStorage.getItem("tick-accent")
  if (accent && /^[a-z]+$/.test(accent)) root.dataset.accent = accent
  var theme = localStorage.getItem("theme")
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  root.classList.add(theme)
} catch (e) {}

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { AuthGate } from "@/components/auth-gate"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"

// Installable app shell (production builds only, so it never interferes with the Vite dev server).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthGate>{(session) => <App {...session} />}</AuthGate>
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>
)

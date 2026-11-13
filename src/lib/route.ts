import { useEffect, useState } from "react"

/** The habit id from a `#/habit/<id>` URL hash, or null on the main screen. Back/forward just work. */
export function useHabitRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return /^#\/habit\/([\w-]+)$/.exec(hash)?.[1] ?? null
}

export const habitHref = (id: string) => `#/habit/${id}`

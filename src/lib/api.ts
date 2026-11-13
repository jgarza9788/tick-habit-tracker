import type { Habit } from "@/lib/habits"

/** Fired when a data request comes back 401 (session expired/signed out elsewhere) so the app can show the login. */
export const UNAUTHORIZED_EVENT = "tick:unauthorized"

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || res.statusText)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export type AuthStatus = { needsSetup: boolean; authenticated: boolean; username: string | null }

// Day toggles are sent one at a time per habit+date so they reach the server in click order.
const dayQueue = new Map<string, { tail: Promise<unknown>; pending: number }>()

function queueDay(id: string, date: string, done: boolean): Promise<Habit | undefined> {
  const key = `${id}:${date}`
  const q = dayQueue.get(key) ?? { tail: Promise.resolve(), pending: 0 }
  dayQueue.set(key, q)
  q.pending++
  const run = q.tail.then(
    () => request<Habit>("PUT", `/api/habits/${id}/days/${date}`, { done }),
    () => request<Habit>("PUT", `/api/habits/${id}/days/${date}`, { done })
  )
  q.tail = run.catch(() => undefined)
  return run
    .catch((e) => {
      // A newer toggle for this day is still queued and will settle the final state, so don't report this failure.
      if (q.pending > 1) return undefined
      throw e
    })
    .finally(() => {
      if (--q.pending === 0) dayQueue.delete(key)
    })
}

export const api = {
  list: () => request<{ habits: Habit[] }>("GET", "/api/habits").then((r) => r.habits),
  create: (name: string, createdAt: string) => request<Habit>("POST", "/api/habits", { name, createdAt }),
  rename: (id: string, name: string) => request<Habit>("PATCH", `/api/habits/${id}`, { name, emoji: "" }),
  update: (id: string, patch: { archived?: boolean; note?: string }) => request<Habit>("PATCH", `/api/habits/${id}`, patch),
  reorder: (ids: string[]) => request<{ habits: Habit[] }>("PUT", "/api/habits/order", { ids }),
  remove: (id: string) => request<void>("DELETE", `/api/habits/${id}`),
  setDay: queueDay,
  importData: (data: unknown) => request<{ habits: Habit[] }>("POST", "/api/import", data).then((r) => r.habits),
}

export const auth = {
  status: () => request<AuthStatus>("GET", "/api/auth/status"),
  setup: (username: string, password: string) =>
    request<{ username: string }>("POST", "/api/auth/setup", { username, password }),
  login: (username: string, password: string) =>
    request<{ username: string }>("POST", "/api/auth/login", { username, password }),
  logout: () => request<void>("POST", "/api/auth/logout", {}),
  changePassword: (current: string, next: string) =>
    request<{ username: string }>("POST", "/api/auth/password", { current, next }),
}

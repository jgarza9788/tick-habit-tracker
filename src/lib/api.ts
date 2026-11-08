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

export const api = {
  list: () => request<{ habits: Habit[] }>("GET", "/api/habits").then((r) => r.habits),
  create: (name: string, createdAt: string) => request<Habit>("POST", "/api/habits", { name, createdAt }),
  remove: (id: string) => request<void>("DELETE", `/api/habits/${id}`),
  setDay: (id: string, date: string, done: boolean) =>
    request<Habit>("PUT", `/api/habits/${id}/days/${date}`, { done }),
}

export const auth = {
  status: () => request<AuthStatus>("GET", "/api/auth/status"),
  setup: (username: string, password: string) =>
    request<{ username: string }>("POST", "/api/auth/setup", { username, password }),
  login: (username: string, password: string) =>
    request<{ username: string }>("POST", "/api/auth/login", { username, password }),
  logout: () => request<void>("POST", "/api/auth/logout", {}),
}

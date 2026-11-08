import { useCallback, useEffect, useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { auth, UNAUTHORIZED_EVENT } from "@/lib/api"

type State =
  | { kind: "loading" }
  | { kind: "unreachable" }
  | { kind: "setup" }
  | { kind: "login" }
  | { kind: "authed"; username: string }

const MIN_PASSWORD = 8

/** Shows first-run account creation or sign-in until there is a valid session, then renders the app. */
export function AuthGate({ children }: { children: (session: { username: string; onLogout: () => void }) => React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  const check = useCallback(() => {
    auth
      .status()
      .then((s) =>
        setState(s.authenticated && s.username ? { kind: "authed", username: s.username } : { kind: s.needsSetup ? "setup" : "login" })
      )
      .catch(() => setState({ kind: "unreachable" }))
  }, [])

  useEffect(() => {
    check()
    const onExpired = () => setState((s) => (s.kind === "authed" ? { kind: "login" } : s))
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired)
  }, [check])

  if (state.kind === "loading") return <div className="min-h-svh" aria-busy="true" />

  if (state.kind === "unreachable")
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center px-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Can't reach the server</EmptyTitle>
            <EmptyDescription>Check that the Tick server is running.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={check}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )

  if (state.kind === "authed")
    return <>{children({ username: state.username, onLogout: () => setState({ kind: "login" }) })}</>

  return <AuthScreen mode={state.kind} onDone={(username) => setState({ kind: "authed", username })} />
}

function AuthScreen({ mode, onDone }: { mode: "setup" | "login"; onDone: (username: string) => void }) {
  const setup = mode === "setup"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false) // reveal the password(s)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (setup && password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (setup && password !== confirm) return setError("Passwords don't match.")
    setBusy(true)
    try {
      const r = await (setup ? auth.setup : auth.login)(username.trim(), password)
      onDone(r.username)
    } catch (err) {
      setError((err as Error).message)
      setPassword("")
      setConfirm("")
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="pane-in flex flex-col items-center gap-3 text-center">
        <Logo className="size-16 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">{setup ? "Welcome to Tick" : "Sign in to Tick"}</h1>
      </div>
      <Card className="pane-in" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>{setup ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {setup ? "This is the only account. Pick something you'll remember." : "Enter your username and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={40}
                  autoFocus
                  required
                  aria-invalid={!!error || undefined}
                />
              </Field>
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={setup ? "new-password" : "current-password"}
                    autoCapitalize="none"
                    spellCheck={false}
                    className="pr-10"
                    required
                    aria-invalid={!!error || undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                  >
                    {show ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </Field>
              {setup && (
                <Field data-invalid={!!error || undefined}>
                  <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                  <Input
                    id="confirm"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    aria-invalid={!!error || undefined}
                  />
                </Field>
              )}
            </FieldGroup>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy || !username.trim() || !password}>
              {busy ? "One moment…" : setup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

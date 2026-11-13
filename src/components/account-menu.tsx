import { useState } from "react"
import { KeyRoundIcon, LogOutIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { auth } from "@/lib/api"

const MIN_PASSWORD = 8

/** Account button: shows who is signed in, and offers "Change password" and "Sign out". */
export function AccountMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon-lg" aria-label={`Account (${username})`} title={`Account (${username})`} />}>
          <UserRoundIcon />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 gap-1 p-2">
          <PopoverTitle className="truncate px-2 py-1 text-sm font-medium">Signed in as {username}</PopoverTitle>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              setMenuOpen(false)
              setPwOpen(true)
            }}
          >
            <KeyRoundIcon data-icon="inline-start" />
            Change password
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              setMenuOpen(false)
              setSignOutOpen(true)
            }}
          >
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </PopoverContent>
      </Popover>
      <PasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Tick?</AlertDialogTitle>
            <AlertDialogDescription>You'll be signed out of {username} on this device. Your habits stay safe on the server.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={() => auth.logout().finally(onLogout)}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setCurrent("")
    setNext("")
    setConfirm("")
    setError("")
    setBusy(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (next.length < MIN_PASSWORD) return setError(`New password must be at least ${MIN_PASSWORD} characters.`)
    if (next !== confirm) return setError("New passwords don't match.")
    setBusy(true)
    try {
      await auth.changePassword(current, next)
      toast.success("Password changed", { description: "Other devices will need to sign in again." })
      onOpenChange(false)
      reset()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="top-16 translate-y-0 sm:top-24">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>You'll stay signed in here; every other device is signed out.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
              <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus required />
            </Field>
            <Field>
              <FieldLabel htmlFor="pw-new">New password</FieldLabel>
              <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
              <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </Field>
          </FieldGroup>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !current || !next || !confirm}>
              {busy ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

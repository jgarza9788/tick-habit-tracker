import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the trimmed name when the form is submitted. */
  onSubmit: (name: string) => void
  /** Starting text for the field (the current name when renaming). */
  initial?: string
  mode?: "add" | "rename"
}

export function AddHabitDialog({ open, onOpenChange, onSubmit, initial = "", mode = "add" }: Props) {
  const [name, setName] = useState(initial)
  const renaming = mode === "rename"

  // Each time the dialog opens, start from the given text (empty for a new habit, current name for a rename).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(initial)
  }, [open, initial])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-16 translate-y-0 sm:top-24">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{renaming ? "Rename habit" : "New habit"}</DialogTitle>
            <DialogDescription>
              {renaming
                ? "Your ticks and streak stay exactly as they are. Tip: start the name with an emoji."
                : "What do you want to do every day? Tip: start the name with an emoji."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="habit-title">Habit</FieldLabel>
              <Input
                id="habit-title"
                name="habit-title"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="📚 Read 20 pages"
                maxLength={60}
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint="done"
                data-1p-ignore
                data-lpignore="true"
                autoFocus
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {renaming ? "Save" : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

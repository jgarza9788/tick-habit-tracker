import { useState } from "react"

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
  onAdd: (name: string) => void
}

export function AddHabitDialog({ open, onOpenChange, onAdd }: Props) {
  const [name, setName] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New habit</DialogTitle>
            <DialogDescription>What do you want to do every day? Tip: start the name with an emoji.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="habit-name">Name</FieldLabel>
              <Input
                id="habit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="📚 Read 20 pages"
                maxLength={60}
                autoComplete="off"
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
              Add habit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

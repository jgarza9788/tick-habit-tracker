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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const EMOJIS = ["💧", "📚", "🏃", "🧘", "🥗", "😴", "✍️", "🎸"]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, emoji: string) => void
}

export function AddHabitDialog({ open, onOpenChange, onAdd }: Props) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, emoji)
    setName("")
    setEmoji("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New habit</DialogTitle>
            <DialogDescription>What do you want to do every day?</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="habit-name">Name</FieldLabel>
              <Input
                id="habit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Read 20 pages"
                maxLength={60}
                autoComplete="off"
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel>Icon (optional)</FieldLabel>
              <ToggleGroup
                variant="outline"
                className="flex-wrap"
                value={emoji ? [emoji] : []}
                onValueChange={(v) => setEmoji(v[0] ?? "")}
              >
                {EMOJIS.map((e) => (
                  <ToggleGroupItem key={e} value={e} aria-label={`Icon ${e}`}>
                    {e}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
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

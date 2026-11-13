import { useRef, useState } from "react"
import { DownloadIcon, UploadIcon } from "lucide-react"
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
import { api } from "@/lib/api"
import type { Habit } from "@/lib/habits"

/** Export / import of all habits as a JSON backup. Desktop only (hidden below the lg breakpoint). */
export function BackupButtons({ onImported }: { onImported: (habits: Habit[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<unknown>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data || !Array.isArray(data.habits)) throw new Error("not a backup")
      setPending(data)
    } catch {
      toast.error("Couldn't read that file", { description: "Choose a backup file exported from Tick." })
    }
  }

  const confirm = () => {
    const data = pending
    setPending(null)
    api
      .importData(data)
      .then((habits) => {
        onImported(habits)
        toast.success("Backup restored", { description: `${habits.length} habit${habits.length === 1 ? "" : "s"} imported.` })
      })
      .catch((e: Error) => toast.error("Import failed", { description: e.message }))
  }

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Export backup"
        title="Export backup (JSON)"
        onClick={() => window.location.assign("/api/export")}
      >
        <DownloadIcon />
      </Button>
      <Button variant="ghost" size="icon-lg" aria-label="Import backup" title="Import backup (JSON)" onClick={() => input.current?.click()}>
        <UploadIcon />
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = "" // allow picking the same file again
        }}
      />

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all habits with this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current habits and history will be overwritten. Export first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirm}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

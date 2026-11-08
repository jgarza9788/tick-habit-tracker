/** Streak levels: the badge and card get more spectacular as a streak grows. */
export type TierId = "none" | "spark" | "warm" | "hot" | "blaze" | "legend"

const TIERS: { id: TierId; min: number; name: string }[] = [
  { id: "legend", min: 30, name: "Legendary" },
  { id: "blaze", min: 14, name: "Blazing" },
  { id: "hot", min: 7, name: "On fire" },
  { id: "warm", min: 3, name: "Heating up" },
  { id: "spark", min: 1, name: "Spark" },
]

export const tierFor = (n: number) => TIERS.find((t) => n >= t.min) ?? { id: "none" as TierId, min: 0, name: "" }

export const MILESTONES = [3, 7, 14, 30, 60, 100]

export const nextMilestone = (n: number) => MILESTONES.find((m) => m > n) ?? null
export const prevMilestone = (n: number) => [...MILESTONES].reverse().find((m) => m <= n) ?? 0

export const MILESTONE_COPY: Record<number, { title: string; body: string }> = {
  3: { title: "Heating up! 🔥", body: "3 days in a row. The habit is forming." },
  7: { title: "A full week! 🔥🔥", body: "7 days straight. You're on fire." },
  14: { title: "Two weeks strong 💪", body: "14 days. This is becoming who you are." },
  30: { title: "A whole month! 👑", body: "30 days. Legendary." },
  60: { title: "60 days 🚀", body: "Two months. Nothing can stop you now." },
  100: { title: "100 days!!! 🏆", body: "Triple digits. Absolute legend." },
}

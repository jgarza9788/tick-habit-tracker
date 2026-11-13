import { describe, expect, it } from "vitest"

import { addDays, counts, fmt, lastDays, lifetimeRate, longestStreak, monthCells, rate, startOfWeek, streak, weeklyRates, type Habit } from "./habits"

const habit = (days: string[], createdAt = "2026-01-01"): Habit => ({
  id: "h",
  name: "Test",
  emoji: "",
  createdAt,
  days: Object.fromEntries(days.map((d) => [d, true as const])),
})

const TODAY = new Date(2026, 10, 13) // Fri 2026-11-13

describe("dates", () => {
  it("formats local dates with zero padding", () => {
    expect(fmt(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  it("adds days across month and year boundaries", () => {
    expect(fmt(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01")
    expect(fmt(addDays(new Date(2026, 2, 1), -1))).toBe("2026-02-28")
  })

  it("starts the week on Monday", () => {
    expect(fmt(startOfWeek(TODAY))).toBe("2026-11-09") // Friday -> Monday
    expect(fmt(startOfWeek(new Date(2026, 10, 15)))).toBe("2026-11-09") // Sunday -> previous Monday
    expect(fmt(startOfWeek(new Date(2026, 10, 9)))).toBe("2026-11-09") // Monday -> itself
  })

  it("lists the last n days oldest first, ending on the given day", () => {
    expect(lastDays(TODAY, 3).map(fmt)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13"])
  })
})

describe("streak", () => {
  it("is 0 with no ticks", () => {
    expect(streak(habit([]), TODAY)).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    expect(streak(habit(["2026-11-11", "2026-11-12", "2026-11-13"]), TODAY)).toBe(3)
  })

  it("keeps the streak alive when today isn't ticked yet", () => {
    expect(streak(habit(["2026-11-11", "2026-11-12"]), TODAY)).toBe(2)
  })

  it("breaks after a missed day", () => {
    expect(streak(habit(["2026-11-10", "2026-11-12", "2026-11-13"]), TODAY)).toBe(2)
    expect(streak(habit(["2026-11-10", "2026-11-11"]), TODAY)).toBe(0) // yesterday also missed
  })

  it("counts across a month boundary", () => {
    expect(streak(habit(["2026-10-31", "2026-11-01"]), new Date(2026, 10, 1))).toBe(2)
  })
})

describe("counts and rate", () => {
  it("only counts days from creation, unless ticked anyway", () => {
    const h = habit(["2025-12-31"], "2026-01-01")
    expect(counts(h, "2025-12-30")).toBe(false)
    expect(counts(h, "2025-12-31")).toBe(true)
    expect(counts(h, "2026-01-01")).toBe(true)
  })

  it("returns null when nothing applies", () => {
    expect(rate([], lastDays(TODAY, 7))).toBeNull()
    expect(rate([habit([], "2027-01-01")], lastDays(TODAY, 7))).toBeNull()
  })

  it("computes the completion fraction across habits and days", () => {
    const days = lastDays(TODAY, 4)
    const a = habit([fmt(days[0]), fmt(days[1])]) // 2 of 4
    const b = habit([fmt(days[3])]) // 1 of 4
    expect(rate([a, b], days)).toBeCloseTo(3 / 8)
  })

  it("ignores days before a habit existed", () => {
    const days = lastDays(TODAY, 4) // 10th..13th
    const h = habit(["2026-11-12", "2026-11-13"], "2026-11-12") // only 12th, 13th apply
    expect(rate([h], days)).toBe(1)
  })
})

describe("longestStreak", () => {
  it("is 0 with no ticks", () => {
    expect(longestStreak(habit([]))).toBe(0)
  })

  it("finds the longest run even when it isn't the current one", () => {
    const h = habit(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-11-12", "2026-11-13"])
    expect(longestStreak(h)).toBe(4)
  })

  it("handles month and year boundaries", () => {
    expect(longestStreak(habit(["2025-12-30", "2025-12-31", "2026-01-01"]))).toBe(3)
    expect(longestStreak(habit(["2026-02-28", "2026-03-01"]))).toBe(2)
  })

  it("counts a single day as 1", () => {
    expect(longestStreak(habit(["2026-05-05"]))).toBe(1)
  })
})

describe("lifetimeRate", () => {
  it("is null for a habit created in the future with no ticks", () => {
    expect(lifetimeRate(habit([], "2027-01-01"), TODAY)).toBeNull()
  })

  it("is done days over days since creation, through today", () => {
    const h = habit(["2026-11-12", "2026-11-13"], "2026-11-10") // 10th..13th = 4 days, 2 done
    expect(lifetimeRate(h, TODAY)).toBe(0.5)
  })

  it("includes ticks made before the creation date", () => {
    const h = habit(["2026-11-09"], "2026-11-10") // 9th..13th = 5 days, 1 done
    expect(lifetimeRate(h, TODAY)).toBeCloseTo(1 / 5)
  })
})

describe("weeklyRates", () => {
  it("returns n weeks oldest first, ending with the current week", () => {
    const weeks = weeklyRates(habit([]), TODAY, 3)
    expect(weeks.map((w) => fmt(w.start))).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"])
  })

  it("only counts the current week through today", () => {
    // Mon 9th .. Fri 13th = 5 applicable days; tick 2 of them.
    const [w] = weeklyRates(habit(["2026-11-09", "2026-11-10"]), TODAY, 1)
    expect(w.rate).toBeCloseTo(2 / 5)
  })

  it("is null for weeks before the habit existed", () => {
    const [first] = weeklyRates(habit([], "2026-11-09"), TODAY, 2)
    expect(first.rate).toBeNull()
  })
})

describe("monthCells", () => {
  it("pads the first week so the 1st lands on its Monday-based column", () => {
    const cells = monthCells(2026, 10) // Nov 2026 starts on a Sunday -> 6 leading blanks
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true)
    expect(fmt(cells[6]!)).toBe("2026-11-01")
    expect(cells).toHaveLength(6 + 30)
  })

  it("has no padding when the month starts on Monday", () => {
    const cells = monthCells(2026, 5) // June 2026 starts on a Monday
    expect(fmt(cells[0]!)).toBe("2026-06-01")
  })

  it("handles leap-year February", () => {
    expect(monthCells(2028, 1).filter(Boolean)).toHaveLength(29)
  })
})

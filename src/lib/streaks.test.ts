import { describe, expect, it } from "vitest"

import { MILESTONE_COPY, MILESTONES, nextMilestone, prevMilestone, tierFor } from "./streaks"

describe("tierFor", () => {
  it("has no tier at 0", () => {
    expect(tierFor(0).id).toBe("none")
  })

  it("picks the highest tier reached", () => {
    expect(tierFor(1).id).toBe("spark")
    expect(tierFor(2).id).toBe("spark")
    expect(tierFor(3).id).toBe("warm")
    expect(tierFor(7).id).toBe("hot")
    expect(tierFor(14).id).toBe("blaze")
    expect(tierFor(29).id).toBe("blaze")
    expect(tierFor(30).id).toBe("legend")
    expect(tierFor(1000).id).toBe("legend")
  })
})

describe("milestones", () => {
  it("finds the next milestone strictly above the streak", () => {
    expect(nextMilestone(0)).toBe(3)
    expect(nextMilestone(3)).toBe(7)
    expect(nextMilestone(364)).toBe(365)
    expect(nextMilestone(365)).toBeNull()
  })

  it("finds the previous milestone at or below the streak", () => {
    expect(prevMilestone(0)).toBe(0)
    expect(prevMilestone(2)).toBe(0)
    expect(prevMilestone(3)).toBe(3)
    expect(prevMilestone(99)).toBe(60)
  })

  it("has celebration copy for every milestone", () => {
    for (const m of MILESTONES) expect(MILESTONE_COPY[m]?.title).toBeTruthy()
  })
})

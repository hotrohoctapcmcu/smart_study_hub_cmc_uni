import { describe, expect, it } from "vitest";
import { assertFutureDateTime, assertPlanningDate, defaultStudySlot, nextDateForTime, nextPlanningMinute, planningNow, validateAIPlanningOptions } from "../utils/planning";

describe("Planning clock uses UTC+7", () => {
  const now = new Date("2026-11-04T09:30:30Z");
  it("compares the current minute and preserves the next minute", () => {
    expect(() => assertFutureDateTime("2026-11-04T16:30", "Bắt đầu", now)).toThrow(/hiện tại/);
    expect(() => assertFutureDateTime("2026-11-04T16:31", "Bắt đầu", now)).not.toThrow();
    expect(nextPlanningMinute(now)).toBe("2026-11-04T16:31");
  });
  it("uses the Vietnam day at a UTC date boundary", () => {
    const midnight = new Date("2026-11-04T17:00:00Z");
    expect(planningNow(midnight)).toEqual({ date: "2026-11-05", time: "00:00", dateTime: "2026-11-05T00:00" });
    expect(() => assertPlanningDate("2026-11-04", "Ngày học", midnight)).toThrow(/đã qua/);
    expect(() => assertFutureDateTime("2026-11-05T07:00", "Bắt đầu", midnight)).not.toThrow();
  });
  it.each(["2026-02-30T19:00", "2026-11-05T24:00", "", "2026-11-05Tbad"])('rejects invalid input "%s"', value => {
    expect(() => assertFutureDateTime(value, "Bắt đầu", now)).toThrow(/không hợp lệ/);
  });
  it("chooses a future default slot after 19:00 and moves to tomorrow after study hours", () => {
    expect(defaultStudySlot(new Date("2026-11-04T12:10:00Z"))).toEqual({ studyDate: "2026-11-04", startTime: "19:15", endTime: "20:15" });
    expect(defaultStudySlot(new Date("2026-11-04T14:30:00Z"))).toEqual({ studyDate: "2026-11-05", startTime: "19:00", endTime: "20:00" });
    expect(nextDateForTime("08:00", now)).toBe("2026-11-05");
  });
  it("rejects an AI planning window that has entirely elapsed today", () => {
    expect(() => validateAIPlanningOptions({ startDate: "2026-11-04", endDate: "2026-11-04", freeStartTime: "08:00", freeEndTime: "10:00", durationMinutes: 60 }, now)).toThrow(/hiện tại/);
  });
});

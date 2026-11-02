import { describe, expect, it } from "vitest";
import { expandClassSchedules, mapSchedule } from "../utils/scheduleAdapter";

const rule = {
  timetable_id: 12,
  subject_name: "CSDL",
  day_of_week: 2,
  start_date: "2026-10-01",
  end_date: "2026-11-30",
  start_time: "08:00:00",
  end_time: "10:00:00",
};

describe("Backend recurring timetable contract", () => {
  it("dates weekly rules within the requested month and keeps backend IDs", () => {
    const rows = expandClassSchedules([rule], "2026-10-26", "2026-11-08");
    expect(rows.map(mapSchedule)).toMatchObject([
      { id: 12, subjectName: "CSDL", studyDate: "2026-10-26" },
      { id: 12, subjectName: "CSDL", studyDate: "2026-11-02" },
    ]);
    expect(rule).not.toHaveProperty("study_date");
  });

  it("clips to inclusive semester boundaries and handles backend Sunday=8", () => {
    const rows = expandClassSchedules([
      { ...rule, day_of_week: 8, start_date: "2026-10-29", end_date: "2026-11-01" },
    ], "2026-10-01", "2026-11-30");
    expect(rows.map(row => row.study_date)).toEqual(["2026-11-01"]);
    expect(expandClassSchedules([rule], "2026-12-01", "2026-12-07")).toEqual([]);
  });

  it("supports list view, already dated rows, and incomplete rules", () => {
    expect(expandClassSchedules([{ ...rule, end_date: "2026-10-12" }])
      .map(row => row.study_date)).toEqual(["2026-10-05", "2026-10-12"]);
    const dated = { timetable_id: 5, study_date: "2026-10-29" };
    expect(expandClassSchedules([dated], "2026-10-26", "2026-11-01")).toEqual([dated]);
    expect(expandClassSchedules([dated], "2026-11-02", "2026-11-08")).toEqual([]);
    expect(expandClassSchedules([{ timetable_id: 3 }])).toEqual([]);
  });
});

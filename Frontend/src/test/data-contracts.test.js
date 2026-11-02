import { describe, expect, it } from "vitest";
import { unwrapResponse } from "../api/apiClient";
import { mapStudent, mapGrades, mapSubjects } from "../utils/studentAdapter";
import { mapExam } from "../utils/examAdapter";
import { mapTimeBlocks, dailyStudyHours } from "../utils/progressAdapter";
import { searchApi } from "../api";

describe("Actual backend data contracts", () => {
  it("preserves an explicitly empty payload and valid scalar values", () => {
    expect(unwrapResponse({ config: {}, data: { success: true, data: null } })).toBeNull();
    expect(unwrapResponse({ success: true, data: false })).toBe(false);
    expect(unwrapResponse({ success: true, data: 0 })).toBe(0);
  });

  it("uses actual grade columns, including a score of zero", () => {
    expect(mapGrades([{ grade_id: 7, subject_id: 2, subject_name: "CSDL", final_score: 0, letter_grade: "F", semester: "1", academic_year: "2026-2027", credits: 3 }])[0]).toMatchObject({ id: 7, subject: "CSDL", score: 0, grade: "F", semester: "1", academicYear: "2026-2027", credits: 3 });
    expect(mapStudent({ avatar_url: "/student.png" }).avatar).toBe("/student.png");
    expect(mapStudent({ fullName: "Sinh viên", studentCode: "BIT1", className: "BIT25", avatarUrl: "/avatar.png" })).toMatchObject({ fullName: "Sinh viên", studentCode: "BIT1", className: "BIT25", avatar: "/avatar.png" });
    expect(mapSubjects([{ subject_id: 2, credits: 3 }])[0].credit).toBe(3);
  });

  it("returns flat workspace search results with backend navigation metadata", async () => {
    const rows = unwrapResponse(await searchApi.search("C#"));
    const emails = unwrapResponse(await searchApi.search("thông báo"));
    expect(Array.isArray(rows)).toBe(true);
    for (const result of [...rows, ...emails]) {
      expect(typeof result.id).toBe("string");
      expect(typeof result.preview).toBe("string");
      expect(Array.isArray(result.tags)).toBe(true);
      expect(result).toHaveProperty("route");
    }
    expect(new Set([...rows, ...emails].map(row => row.type))).toEqual(new Set(["task", "document", "note", "schedule", "exam", "email"]));
    expect(rows.find(row => row.type === "document")).toMatchObject({ route: "documents", docTab: "docs" });
    expect(rows.find(row => row.type === "note")).toMatchObject({ route: "documents", docTab: "notes" });
    expect(rows.find(row => row.type === "schedule")).toHaveProperty("selectedDate");
    expect(emails.find(row => row.type === "email").route).toBe("school-email");
    expect(unwrapResponse(await searchApi.search(""))).toEqual([]);
    const tagged = unwrapResponse(await searchApi.search("", "#OOP"));
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every(row => row.tags.includes("OOP"))).toBe(true);
  });

  it("retains exam details and derives end time from exam duration", () => {
    expect(mapExam({ exam_id: 4, exam_name: "Giữa kỳ", exam_time: "08:30:00", duration_minutes: 90 })).toMatchObject({ id: 4, examName: "Giữa kỳ", startTime: "08:30:00", endTime: "10:00", durationMinutes: 90 });
    expect(mapExam({ exam_time: "08:30", duration_minutes: 90, end_time: "11:00" }).endTime).toBe("11:00");
    expect(mapExam({ exam_time: "08:30" }).endTime).toBe("");
  });

  it("reads date-grouped timemap blocks without counting free time as study", () => {
    const blocks = mapTimeBlocks({ "2026-10-29": [
      { id: "focus", type: "pomodoro", startTime: "2026-10-29T08:00:00+07:00", endTime: "2026-10-29T09:00:00+07:00" },
      { id: "free", type: "free-time", startTime: "2026-10-29T09:00:00+07:00", endTime: "2026-10-29T12:00:00+07:00" },
    ] });
    expect(blocks[0].date).toBe("2026-10-29");
    expect(dailyStudyHours(blocks)).toEqual([{ name: "29/10", value: 1 }]);
    expect(mapTimeBlocks(blocks)).toEqual(blocks);
  });
});

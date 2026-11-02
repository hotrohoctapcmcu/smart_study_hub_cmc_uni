import { describe, it, expect, vi } from "vitest";
import apiClient, { unwrapResponse, responseList } from "../api/apiClient";
import {
  scheduleApi,
  taskApi,
  documentApi,
  healthApi,
  workspaceApi,
} from "../api";
import {
  formatTime,
  formatDateISO,
  parseDate,
  startOfWeek,
  addDays,
} from "../utils/date";
describe("Date and response contracts", () => {
  it("supports backend date formats, pure times and invalid inputs", () => {
    expect(formatTime("08:30")).toBe("08:30");
    expect(formatTime("2026-10-29 08:30:00")).toBe("08:30");
    expect(formatDateISO("2026-10-29")).toBe("2026-10-29");
    expect(parseDate("invalid")).toBe(null);
    expect(formatDateISO(startOfWeek("2026-11-01"))).toBe("2026-10-26");
    expect(formatDateISO(addDays("2026-10-29", 7))).toBe("2026-11-05");
  });
  it("unwraps payload without losing raw response metadata", () => {
    const response = {
      config: {},
      data: { success: true, data: [], date: "2026-10-29", total: 0 },
    };
    expect(unwrapResponse(response)).toEqual([]);
    expect(response.data.total).toBe(0);
    expect(responseList({ data: { courses: [] } }, "courses")).toEqual([]);
    expect(responseList(null)).toEqual([]);
  });
});
describe("API contracts and mutations", () => {
  it("creates, updates, completes and removes a task without replacing snake_case fields", async () => {
    const response = await taskApi.create({
      subjectId: 1,
      title: "Task contract test",
      deadline: "2026-12-01T23:59",
      priority: "HIGH",
    });
    const task = unwrapResponse(response);
    expect(task.assignment_id).toBeDefined();
    expect(task.subject_id).toBe(1);
    await taskApi.update(task.assignment_id, { title: "Updated title" });
    await taskApi.changeStatus(task.assignment_id, "COMPLETED");
    const list = responseList(await taskApi.list());
    expect(
      list.find((t) => t.assignment_id === task.assignment_id).completed_at,
    ).toBeTruthy();
    await taskApi.remove(task.assignment_id);
    expect(
      responseList(await taskApi.list()).some(
        (t) => t.assignment_id === task.assignment_id,
      ),
    ).toBe(false);
  });
  it("uses dedicated free-slot endpoint and keeps root metadata", async () => {
    const response = await scheduleApi.getFreeSlots(formatDateISO(), 60);
    expect(response.config.url).toBe("/schedules/study/free-slots");
    expect(response.data.freeSlots).toBeInstanceOf(Array);
    expect(response.data.date).toBe(formatDateISO());
  });
  it("checks schedule conflicts and allows non-overlapping periods", async () => {
    const result = await scheduleApi.checkConflicts({
      studyDate: formatDateISO(),
      startTime: "08:30",
      endTime: "09:00",
      excludeScheduleId: null,
    });
    expect(result.data.hasConflict).toBe(true);
    expect(
      (
        await scheduleApi.checkConflicts({
          studyDate: formatDateISO(),
          startTime: "21:00",
          endTime: "22:00",
        })
      ).data.hasConflict,
    ).toBe(false);
  });
  it("sends raw File bytes, preserves upload metadata, and downloads exact content", async () => {
    const file = new File(["binary contract"], "test.txt", {
      type: "text/plain",
    });
    const result = await documentApi.upload(file, {
      title: "test.txt",
      subject: "C#",
      filename: "test.txt",
    });
    expect(result.config.data).toBe(file);
    expect(result.config.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(
      JSON.parse(
        decodeURIComponent(result.config.headers.get("X-Document-Meta")),
      ).subject,
    ).toBe("C#");
    const doc = unwrapResponse(result);
    const download = await documentApi.download(doc.id, true);
    expect(download.data).toBe(file);
    await documentApi.remove(doc.id);
  });
  it("calls health at backend origin rather than /api/v1/health", async () => {
    const result = await healthApi.check();
    expect(result.config.baseURL).toBe("http://localhost:3001");
    expect(result.config.url).toBe("/health");
  });
  it("does not turn backend failures into mock success", async () => {
    const original = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async () => {
      throw new Error("Backend unavailable");
    };
    try {
      await expect(taskApi.list()).rejects.toThrow("Backend unavailable");
    } finally {
      apiClient.defaults.adapter = original;
    }
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "../api/apiClient";
import ScheduleEditor from "../components/schedule/ScheduleEditor";

const originalAdapter = apiClient.defaults.adapter;
let requests;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T09:30:00Z"));
  requests = vi.fn(async (config) => ({
    config,
    status: 200,
    headers: {},
    data: config.url === '/sync/current-courses' ? { success: true, data: { resolved: true, courses: [{ subjectId: 1, subjectName: 'Cơ sở dữ liệu' }] } }
      : config.url === "/student/subjects"
      ? { success: true, data: [{ subject_id: 1, subject_name: "Cơ sở dữ liệu" }] }
      : config.url === "/schedules/conflicts/check"
        ? { success: true, hasConflict: false, conflicts: [] }
        : { success: true, data: { schedule_id: 42 } },
  }));
  apiClient.defaults.adapter = requests;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

function requestBody(url) {
  return JSON.parse(requests.mock.calls.find(([config]) => config.url === url)[0].data);
}

async function mount(event) {
  const onSaved = vi.fn();
  render(<ScheduleEditor event={event} onSaved={onSaved} onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cơ sở dữ liệu" });
  return onSaved;
}

async function save(onSaved) {
  fireEvent.submit(screen.getByRole("button", { name: "Lưu lịch học" }).closest("form"));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).toBeNull();
}

describe("Schedule editor request contracts", () => {
  it.each([
    ["study", "2026-11-03", "19:00"],
    ["study", "2026-11-04", "09:00"],
    ["study", "2026-11-04", "16:30"],
    ["class", "2026-11-03", "19:00"],
    ["class", "2026-11-04", "09:00"],
  ])("blocks %s at %s %s before calling the API", async (kind, date, time) => {
    const onSaved = await mount({ kind });
    fireEvent.change(screen.getByLabelText("Ngày học"), { target: { value: date } });
    fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: time } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu lịch học" }).closest("form"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("phải sau thời điểm hiện tại"));
    expect(onSaved).not.toHaveBeenCalled();
    expect(requests.mock.calls.every(([config]) => config.method === "get")).toBe(true);
  });

  it("allows notes on a historical schedule while blocking rescheduling it into the past", async () => {
    const onSaved = await mount({ id: 42, kind: "study", title: "Lịch cũ", studyDate: "2026-11-03", startTime: "19:00", endTime: "20:00" });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Đã học xong" } });
    await save(onSaved);
    fireEvent.change(screen.getByLabelText("Ngày học"), { target: { value: "2026-11-02" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu lịch học" }).closest("form"));
    await screen.findByRole("alert");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(requests.mock.calls.filter(([config]) => config.url === "/schedules/study/42")).toHaveLength(1);
  });

  it("rechecks the clock when an open form is submitted later", async () => {
    const onSaved = await mount({ kind: "study" });
    fireEvent.change(screen.getByLabelText("Tên buổi tự học"), { target: { value: "Ôn bài" } });
    vi.setSystemTime(new Date("2026-11-04T13:30:00Z"));
    fireEvent.submit(screen.getByRole("button", { name: "Lưu lịch học" }).closest("form"));
    await screen.findByRole("alert");
    expect(onSaved).not.toHaveBeenCalled();
    expect(requests.mock.calls.every(([config]) => config.method === "get")).toBe(true);
  });

  it("creates unclassified self-study without classroom fields", async () => {
    const onSaved = await mount({ kind: "study", studyDate: "2026-11-04" });
    fireEvent.change(screen.getByLabelText("Tên buổi tự học"), { target: { value: "Ôn bài" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Chương 1" } });
    await save(onSaved);

    expect(requestBody("/schedules/study")).toEqual({
      title: "Ôn bài", subjectId: null, studyDate: "2026-11-04",
      startTime: "19:00", endTime: "20:00", notes: "Chương 1",
    });
  });

  it("updates existing self-study and excludes its own ID from conflict checks", async () => {
    const onSaved = await mount({
      id: 42, kind: "study", title: "Ôn bài", subjectId: 1,
      studyDate: "2026-11-04", startTime: "19:00:00", endTime: "20:00:00",
      notes: "Chương 1",
    });
    fireEvent.change(screen.getByLabelText("Tên buổi tự học"), { target: { value: "Ôn bài đã sửa" } });
    await save(onSaved);

    expect(requestBody("/schedules/study/42")).toEqual({
      title: "Ôn bài đã sửa", subjectId: 1, studyDate: "2026-11-04",
      startTime: "19:00", endTime: "20:00", notes: "Chương 1",
    });
    expect(requestBody("/schedules/conflicts/check")).toEqual({
      studyDate: "2026-11-04", startTime: "19:00", endTime: "20:00", excludeScheduleId: 42,
    });
    expect(requests.mock.calls.find(([config]) => config.url === "/schedules/study/42")[0].method).toBe("put");
  });

  it("omits hidden classroom values after switching back to self-study", async () => {
    const onSaved = await mount({ kind: "study", studyDate: "2026-11-04" });
    fireEvent.click(screen.getByRole("tab", { name: "Tiết trên lớp" }));
    fireEvent.change(screen.getByLabelText("Môn học"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Lớp"), { target: { value: "BIT25" } });
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "P.101" } });
    fireEvent.click(screen.getByRole("tab", { name: "Lịch tự học" }));
    fireEvent.change(screen.getByLabelText("Tên buổi tự học"), { target: { value: "Ôn bài" } });
    expect(screen.getByRole("tab", { name: "Lịch tự học" }).type).toBe("button");
    expect(screen.getByRole("tab", { name: "Tiết trên lớp" }).type).toBe("button");
    expect(requests.mock.calls.every(([config]) => config.method === "get")).toBe(true);
    await save(onSaved);

    expect(requestBody("/schedules/study")).toEqual({
      title: "Ôn bài", subjectId: 1, studyDate: "2026-11-04",
      startTime: "19:00", endTime: "20:00", notes: "",
    });
  });

  it("keeps classroom fields and converts a Sunday date to the backend weekday", async () => {
    const onSaved = await mount({ kind: "class", studyDate: "2026-11-08" });
    fireEvent.change(screen.getByLabelText("Môn học"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Lớp"), { target: { value: "BIT25" } });
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "P.101" } });
    await save(onSaved);

    expect(requestBody("/schedules")).toEqual({
      subjectId: 1, className: "BIT25", room: "P.101",
      startTime: "19:00", endTime: "20:00",
      startDate: "2026-11-08", endDate: "2026-11-08", dayOfWeek: 8,
    });
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import TaskEditor from "../components/tasks/TaskEditor";
import Exams from "../pages/Exams/Exams";
import Schedule from "../pages/Schedule/Schedule";
import AITutor from "../pages/AITutor/AITutor";
import Profile from "../pages/Profile/Profile";
import apiClient from "../api/apiClient";

const originalAdapter = apiClient.defaults.adapter;
let requests, exams;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T09:30:00Z"));
  exams = [{ exam_id: 1, subject_id: 1, subject_name: "CSDL", exam_date: "2026-11-06", exam_time: "08:00", duration_minutes: 90, room: "P.101" }];
  requests = vi.fn(async config => ({
    config, status: 200, headers: {}, data: { success: true, data:
      config.url === "/sync/current-courses" ? { resolved: true, courses: [{ subjectId: 1, subjectName: 'CSDL' }] }
        : config.url === "/student/subjects" ? [{ subject_id: 1, subject_name: "CSDL" }]
        : config.url === "/student/profile" ? { full_name: "Planning Tester", student_code: "PLAN-UI", major: "IT" }
        : config.url === "/schedules/study/free-slots" ? { freeSlots: [{ start_time: "19:00", end_time: "22:00" }] }
        : config.url === "/exams" && config.method === "get" ? exams : [] },
  }));
  apiClient.defaults.adapter = requests;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; vi.useRealTimers(); });

function mount(children) {
  return render(<MemoryRouter><AppProvider>{children}</AppProvider></MemoryRouter>);
}
function change(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function submit(label) { fireEvent.submit(screen.getByRole("button", { name: label }).closest("form")); }
function writes(url) { return requests.mock.calls.filter(([config]) => config.method !== "get" && (!url || config.url === url)); }
async function planEditor() {
  mount(<Exams />);
  fireEvent.click(await screen.findByRole("button", { name: "Lên lịch ôn" }));
}

describe("Past dates and invalid planning ranges in forms", () => {
  it("rejects a future birth date and allows a historical birth date", async () => {
    mount(<Profile />);
    fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    expect(screen.getByLabelText("Ngày sinh").max).toBe("2026-11-04");
    change("Ngày sinh", "2026-11-05"); submit("Lưu thay đổi");
    await screen.findByText("Ngày sinh không được sau ngày hiện tại.");
    expect(writes()).toHaveLength(0);
    change("Ngày sinh", "2007-01-01"); submit("Lưu thay đổi");
    await waitFor(() => expect(writes("/student/profile")).toHaveLength(1));
  });

  it.each(["2026-11-03T19:00", "2026-11-04T09:00"])("blocks a new task deadline at %s", async deadline => {
    const onSaved = vi.fn();
    mount(<TaskEditor onSaved={onSaved} onClose={vi.fn()} />);
    await screen.findByRole("option", { name: "CSDL" });
    change("Tên công việc", "Ôn bài"); change("Môn học", "1"); change("Hạn hoàn thành", deadline);
    submit("Lưu công việc");
    await screen.findByRole("alert");
    expect(writes()).toHaveLength(0); expect(onSaved).not.toHaveBeenCalled();
    change("Hạn hoàn thành", "2026-11-04T17:00"); submit("Lưu công việc");
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("preserves an overdue task deadline when only its description changes", async () => {
    const onSaved = vi.fn();
    mount(<TaskEditor task={{ id: 7, title: "Việc cũ", subjectId: 1, deadline: "2026-11-03T10:00" }} onSaved={onSaved} onClose={vi.fn()} />);
    await screen.findByRole("option", { name: "CSDL" });
    change("Mô tả", "Ghi chú mới"); submit("Lưu công việc");
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(JSON.parse(writes("/tasks/7")[0][0].data).deadline).toBe("2026-11-03T10:00");
  });

  it.each([["2026-11-03", "19:00"], ["2026-11-04", "08:00"]])("blocks a new exam at %s %s", async (date, time) => {
    mount(<Exams />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm kỳ thi" }));
    await screen.findByRole("option", { name: "CSDL" });
    expect(screen.getByLabelText("Ngày thi").value).toBe("2026-11-05");
    change("Môn học", "1"); change("Phòng thi", "P.101"); change("Ngày thi", date); change("Bắt đầu", time);
    submit("Lưu kỳ thi"); await screen.findByRole("alert"); expect(writes()).toHaveLength(0);
  });

  it("removes an exam that started today from upcoming and disables new review plans", async () => {
    exams = [{ ...exams[0], exam_date: "2026-11-04", exam_time: "08:00" }];
    mount(<Exams />);
    await screen.findByText("Chưa có kỳ thi nào");
    fireEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
    expect(await screen.findByText("Đã diễn ra")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lên lịch ôn" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sửa kỳ thi" }));
    await screen.findByRole("option", { name: "CSDL" });
    change("Phòng thi", "P.202"); submit("Lưu kỳ thi");
    await waitFor(() => expect(writes("/exams/1")).toHaveLength(1));
  });

  it.each([
    ["2026-11-03", "2026-11-05", "đã qua"],
    ["2026-11-05", "2026-11-04", "trước ngày bắt đầu"],
    ["2026-11-04", "2026-11-07", "sau ngày thi"],
  ])("blocks a review range from %s to %s", async (start, end, message) => {
    await planEditor(); change("Từ ngày", start); change("Đến ngày", end); submit("Lưu kế hoạch");
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(writes()).toHaveLength(0);
  });

  it("rechecks an exam start when an open review form is saved", async () => {
    await planEditor();
    vi.setSystemTime(new Date("2026-11-06T01:01:00Z"));
    submit("Lưu kế hoạch");
    expect((await screen.findByRole("alert")).textContent).toContain("Kỳ thi đã bắt đầu");
    expect(writes()).toHaveLength(0);
  });

  it("saves a valid review range", async () => {
    await planEditor(); change("Từ ngày", "2026-11-04"); change("Đến ngày", "2026-11-05"); submit("Lưu kế hoạch");
    await waitFor(() => expect(writes("/exams/study-plans")).toHaveLength(1));
  });

  it("blocks searching for free slots on a past day", async () => {
    mount(<Schedule />);
    change("Ngày", "2026-11-03");
    expect(screen.getByRole("button", { name: "Tìm giờ trống" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Tìm giờ trống" }));
    expect(requests.mock.calls.some(([config]) => config.url === "/schedules/study/free-slots")).toBe(false);
  });

  it("hides stale free-slot results when the selected day or duration changes", async () => {
    mount(<Schedule />);
    fireEvent.click(screen.getByRole("button", { name: "Tìm giờ trống" }));
    await waitFor(() => expect(document.querySelectorAll(".slot-list .badge")).toHaveLength(1));
    change("Ngày", "2026-11-05");
    expect(document.querySelector(".slot-list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tìm giờ trống" }));
    await waitFor(() => expect(document.querySelectorAll(".slot-list .badge")).toHaveLength(1));
    change("Thời lượng (phút)", "90");
    expect(document.querySelector(".slot-list")).toBeNull();
  });

  it.each([
    ["2026-11-03", "2026-11-06"],
    ["2026-11-06", "2026-11-05"],
  ])("blocks an invalid AI planning range %s to %s and keeps the prompt", async (start, end) => {
    mount(<AITutor />);
    change("Công cụ AI", "plan"); change("Từ ngày", start); change("Đến ngày", end);
    change("Tin nhắn cho AI Tutor", "Lập kế hoạch giúp tôi");
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await screen.findByRole("alert"); expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText("Tin nhắn cho AI Tutor").value).toBe("Lập kế hoạch giúp tôi");
  });
});

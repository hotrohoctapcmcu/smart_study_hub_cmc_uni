import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Profile from "../pages/Profile/Profile";
import Exams from "../pages/Exams/Exams";
import apiClient from "../api/apiClient";

const adapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = adapter; });
function mount(Page) {
  return render(<MemoryRouter><AppProvider><Page /></AppProvider></MemoryRouter>);
}
function response(config, data) {
  return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data } };
}

describe("Profile and exam data preservation", () => {
  it("shows backend grade fields and keeps every semester available after filtering and retry", async () => {
    const grades = [
      { grade_id: 11, subject_name: "Giải tích", subject_code: "M101", final_score: 8.5, letter_grade: "A", semester: "HK1" },
      { grade_id: 12, subject_name: "Cấu trúc dữ liệu", subject_code: "CS102", final_score: 0, letter_grade: "F", semester: "HK2" },
    ];
    let fail = false;
    const spy = vi.fn(async (config) => {
      if (config.url !== "/student/grades") return adapter(config);
      if (fail) throw new Error("Grade service unavailable");
      return response(config, config.params?.hocKy ? grades.filter((g) => g.semester === config.params.hocKy) : grades);
    });
    apiClient.defaults.adapter = spy;
    mount(Profile);
    fireEvent.click(screen.getByRole("tab", { name: "Bảng điểm" }));
    expect(await screen.findByText("8.5")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc học kỳ"), { target: { value: "HK1" } });
    await waitFor(() => expect(screen.queryByText("Cấu trúc dữ liệu")).toBeNull());
    expect(screen.getByRole("option", { name: "HK2" })).toBeTruthy();
    fail = true;
    fireEvent.change(screen.getByLabelText("Lọc học kỳ"), { target: { value: "HK2" } });
    await screen.findByText("Grade service unavailable");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Cấu trúc dữ liệu")).toBeTruthy();
    expect(screen.queryByText("Giải tích")).toBeNull();
    const calls = spy.mock.calls.filter(([c]) => c.url === "/student/grades");
    expect(calls.at(-1)[0].params).toEqual({ hocKy: "HK2" });
    expect(screen.getByRole("option", { name: "HK1" })).toBeTruthy();
  });

  it("preserves an existing exam title and duration when only its room changes", async () => {
    const spy = vi.fn(async (config) => {
      if (config.url === "/exams" && config.method === "get") return response(config, [{
        exam_id: 700, subject_id: 1, subject_name: "Lập trình C#", exam_name: "Thi giữa kỳ C#",
        exam_date: "2099-11-15", exam_time: "08:00", duration_minutes: 120, room: "P302",
      }]);
      if (config.url === "/exams/700" && config.method === "put") return response(config, {});
      return adapter(config);
    });
    apiClient.defaults.adapter = spy;
    mount(Exams);
    fireEvent.click(await screen.findByRole("button", { name: "Sửa kỳ thi" }));
    expect(screen.getByLabelText("Tên kỳ thi").value).toBe("Thi giữa kỳ C#");
    expect(screen.getByLabelText("Kết thúc").value).toBe("10:00");
    fireEvent.change(screen.getByLabelText("Phòng thi"), { target: { value: "P999" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu kỳ thi" }).closest("form"));
    await waitFor(() => expect(spy.mock.calls.some(([c]) => c.url === "/exams/700" && c.method === "put")).toBe(true));
    const config = spy.mock.calls.find(([c]) => c.url === "/exams/700" && c.method === "put")[0];
    expect(JSON.parse(config.data)).toMatchObject({ examName: "Thi giữa kỳ C#", durationMinutes: 120, room: "P999", examTime: "08:00" });
  });
});

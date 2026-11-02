import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Learning from "../pages/Learning/Learning";
import Tasks from "../pages/Tasks/Tasks";
import Schedule from "../pages/Schedule/Schedule";
import Email from "../pages/Email/Email";
import Exams from "../pages/Exams/Exams";
import { documentCategory } from "../pages/Documents/Documents";

function mount(Page, route) {
  return render(<MemoryRouter initialEntries={[route]}><AppProvider><Page /></AppProvider></MemoryRouter>);
}

describe("Sidebar and dashboard deep links", () => {
  it("loads flashcard data when the flashcard tab is opened directly", async () => {
    mount(Learning, "/learning?tab=flashcards");
    expect(await screen.findByText("Bốn tính chất cơ bản của OOP là gì?")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Flashcard" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("combobox", { name: "Bộ flashcard" })).toBeTruthy();
  });

  it("loads weakness analysis from its direct link", async () => {
    mount(Learning, "/learning?tab=weaknesses");
    expect(screen.getByRole("tab", { name: "Điểm cần cải thiện" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByRole("button", { name: "Phân tích" })).toBeTruthy();
  });

  it("opens the task creation form from the dashboard shortcut", async () => {
    mount(Tasks, "/tasks?action=create");
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Tên công việc")).toBeTruthy();
  });

  it("opens the study schedule form from its shortcut", async () => {
    mount(Schedule, "/schedule?action=create");
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Tên buổi tự học")).toBeTruthy();
  });

  it("combines task priority and subject filters and clears them", async () => {
    mount(Tasks, "/tasks");
    const list = within(screen.getByRole("region", { name: "D. Danh sách công việc" }));
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Làm bài tập Chương 3");
    fireEvent.change(screen.getByLabelText("Lọc theo môn học"), { target: { value: "Lập trình C#" } });
    fireEvent.change(screen.getByLabelText("Lọc theo ưu tiên"), { target: { value: "URGENT" } });
    expect(list.getByText("Làm bài tập Chương 3")).toBeTruthy();
    expect(list.queryByText("Ôn SQL cho bài kiểm tra")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(list.getByText("Ôn SQL cho bài kiểm tra")).toBeTruthy();
  });

  it("groups legacy extensions and API MIME types consistently", () => {
    expect(documentCategory("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("word");
    expect(documentCategory("doc")).toBe("word");
    expect(documentCategory("application/vnd.ms-powerpoint")).toBe("slides");
    expect(documentCategory("image/png")).toBe("image");
    expect(documentCategory("jpg")).toBe("image");
  });

  it("filters school mail by read state and sender text", async () => {
    mount(Email, "/email");
    await screen.findByText("Thông báo lịch kiểm tra giữa kỳ");
    fireEvent.click(screen.getByRole("button", { name: /Chưa đọc/ }));
    expect(screen.getByText("Thông báo lịch kiểm tra giữa kỳ")).toBeTruthy();
    expect(screen.queryByText("Tài liệu ôn tập môn Cơ sở dữ liệu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Đã đọc/ }));
    expect(screen.queryByText("Thông báo lịch kiểm tra giữa kỳ")).toBeNull();
    expect(screen.getByText("Tài liệu ôn tập môn Cơ sở dữ liệu")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Tìm email..."), { target: { value: "khong-ton-tai" } });
    expect(screen.getByText("Không có email phù hợp")).toBeTruthy();
  });

  it("opens an exam from its monthly calendar", async () => {
    mount(Exams, "/exams");
    await screen.findByRole("heading", { name: "Lập trình C#" });
    fireEvent.click(screen.getByRole("tab", { name: "Lịch thi" }));
    const today = new Date(), examDate = new Date();
    examDate.setDate(today.getDate() + 17);
    if (examDate.getMonth() !== today.getMonth()) fireEvent.click(screen.getByRole("button", { name: "Tháng thi sau" }));
    fireEvent.click(await screen.findByRole("button", { name: /08:00 · Lập trình C#/ }));
    expect(await screen.findByRole("dialog", { name: "Sửa kỳ thi" })).toBeTruthy();
  });
});

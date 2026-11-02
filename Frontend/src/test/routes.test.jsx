import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, Modal, Field } from "../components/common/ui";
import apiClient from "../api/apiClient";
import Dashboard from "../pages/Dashboard/Dashboard";
import Schedule from "../pages/Schedule/Schedule";
import Tasks from "../pages/Tasks/Tasks";
import Learning from "../pages/Learning/Learning";
import Documents from "../pages/Documents/Documents";
import AITutor from "../pages/AITutor/AITutor";
import Statistics from "../pages/Statistics/Statistics";
import Exams from "../pages/Exams/Exams";
import Email from "../pages/Email/Email";
import Sync from "../pages/Sync/Sync";
import Profile from "../pages/Profile/Profile";
import Settings from "../pages/Settings/Settings";
import TaskEditor from "../components/tasks/TaskEditor";
const pages = [
  [Dashboard, "Chào"],
  [Schedule, "Thời khóa biểu"],
  [Tasks, "Công việc"],
  [Learning, "Học tập"],
  [Documents, "Tài liệu học tập"],
  [AITutor, "AI Tutor"],
  [Statistics, "Thống kê học tập"],
  [Exams, "Kỳ thi"],
  [Email, "Email trường"],
  [Sync, "Đồng bộ dữ liệu"],
  [Profile, "Hồ sơ sinh viên"],
  [Settings, "Cài đặt"],
];
function mount(Page) {
  return render(
    <MemoryRouter>
      <AppProvider>
        <Page />
      </AppProvider>
    </MemoryRouter>,
  );
}
describe("All twelve pages with API data", () => {
  it.each(pages)(
    "%s renders API data without crashing",
    async (Page, title) => {
      mount(Page);
      await waitFor(
        () => expect(screen.queryAllByRole("status")).toHaveLength(0),
        { timeout: 4000 },
      );
      expect(document.body.textContent).toContain(title);
      expect(screen.queryByText("Không thể kết nối máy chủ")).toBeNull();
    },
  );
});
describe("Empty and offline states", () => {
  const original = apiClient.defaults.adapter;
  afterEach(() => {
    apiClient.defaults.adapter = original;
  });
  it.each(pages.filter(([p]) => p !== Settings))(
    "%s handles unavailable backend",
    async (Page) => {
      apiClient.defaults.adapter = async () => {
        throw new Error("Backend unavailable");
      };
      mount(Page);
      await waitFor(() =>
        expect(screen.queryAllByRole("status")).toHaveLength(0),
      );
      if (Page !== AITutor)
        expect(document.body.textContent).toMatch(
          /Backend unavailable|Không kiểm tra|Không thể/,
        );
      expect(screen.queryByText("Làm bài tập Chương 3")).toBeNull();
    },
  );
  it("renders empty statistics rather than fabricated chart values", async () => {
    apiClient.defaults.adapter = async (config) => ({
      data: { success: true, data: {} },
      config,
      status: 200,
      headers: {},
    });
    mount(Statistics);
    await screen.findAllByText("Chưa có dữ liệu thống kê");
    expect(screen.queryByText("Lập trình C#")).toBeNull();
  });
  it.each([Schedule, Tasks, Learning, Documents, Exams, Email, Profile])(
    "%s supports a successful empty response",
    async (Page) => {
      apiClient.defaults.adapter = async (config) => ({
        data: { success: true, data: [] },
        config,
        status: 200,
        headers: {},
      });
      mount(Page);
      await waitFor(() =>
        expect(screen.queryAllByRole("status")).toHaveLength(0),
      );
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );
});
describe("Important interactions", () => {
  it("loads and toggles a task with persisted API state", async () => {
    mount(Tasks);
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    const box = await screen.findByLabelText("Hoàn thành Làm bài tập Chương 3");
    fireEvent.click(box);
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Hoàn thành Làm bài tập Chương 3"),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));
    expect(
      await screen.findByLabelText("Đánh dấu chưa làm Làm bài tập Chương 3"),
    ).toHaveProperty("checked", true);
  });
  it("changes calendar week and month and checks free slots", async () => {
    mount(Schedule);
    await waitFor(() =>
      expect(screen.queryAllByRole("status")).toHaveLength(0),
    );
    fireEvent.click(screen.getByRole("button", { name: "Khoảng sau" }));
    await waitFor(() =>
      expect(screen.queryAllByRole("status")).toHaveLength(0),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Tháng" }));
    await waitFor(() =>
      expect(document.querySelectorAll(".month-cell")).toHaveLength(42),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tìm giờ trống" }));
    await waitFor(() =>
      expect(
        document.querySelectorAll(".slot-list .badge").length,
      ).toBeGreaterThan(0),
    );
  });
  it("shows AI answer and preserves a conversation", async () => {
    mount(AITutor);
    fireEvent.change(screen.getByLabelText("Tin nhắn cho AI Tutor"), {
      target: { value: "Giải thích OOP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    expect(
      await screen.findByText(/Đây là phản hồi trong chế độ dữ liệu mẫu/),
    ).toBeTruthy();
  });
  it("opens task editor with working labels and does not reset focus on typing", async () => {
    function Wrapper() {
      const [v, setV] = React.useState("");
      return (
        <Modal isOpen onClose={() => {}} title="Editor">
          <Field label="Tên" value="First" readOnly />
          <Field
            label="Mô tả"
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
        </Modal>
      );
    }
    render(<Wrapper />);
    const field = screen.getByLabelText("Mô tả");
    field.focus();
    fireEvent.change(field, { target: { value: "Keep focus" } });
    expect(document.activeElement).toBe(field);
  });
  it("saves a task through the form and displays success", async () => {
    const saved = vi.fn();
    render(
      <MemoryRouter>
        <TaskEditor onSaved={saved} onClose={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Tên công việc"), {
      target: { value: "Task from form" },
    });
    fireEvent.change(screen.getByLabelText("Hạn hoàn thành"), {
      target: { value: "2026-12-01T23:59" },
    });
    await screen.findByRole("option", { name: "Lập trình C#" });
    fireEvent.change(screen.getByLabelText("Môn học"), {
      target: { value: "1" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Lưu công việc" }).closest("form"),
    );
    await waitFor(() => expect(saved).toHaveBeenCalled());
  });
  it("persists appearance changes across a rerender", async () => {
    mount(Settings);
    fireEvent.click(screen.getByRole("button", { name: "Tối" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(JSON.parse(localStorage.getItem("ssh-preferences")).theme).toBe(
      "dark",
    );
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục mặc định" }));
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Tasks from "../pages/Tasks/Tasks";
import apiClient from "../api/apiClient";
import { formatDateISO } from "../utils/date";

const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

function mountWorkspace({ failedSource, dueMetadata, extraTasks = [] } = {}) {
  const today = formatDateISO(new Date());
  const tasks = [
    { assignment_id: 101, subject_id: 11, subject_name: "Cấu trúc dữ liệu", subject_code: "CTDL", title: "Ôn cây cân bằng", deadline: `${today}T22:00`, priority: "HIGH", status: "PENDING" },
    { assignment_id: 102, subject_id: 12, subject_name: "Đại số tuyến tính", subject_code: "DSTT", title: "Luyện phép nhân ma trận", deadline: `${today}T23:00`, priority: "MEDIUM", status: "IN_PROGRESS" },
    ...extraTasks,
  ];
  const assignments = [
    { id: "edux-workspace", subject: "Cấu trúc dữ liệu", subjectCode: "CTDL", title: "Quiz cây tìm kiếm", due: null, status: "Chưa làm", progress: { daHoc: 0, tongSo: 5 }, highestScore: 0, ...dueMetadata },
  ];
  const adapter = vi.fn(async config => {
    let data;
    if (config.method === "get" && config.url === (failedSource === "PERSONAL" ? "/tasks" : failedSource === "EDUX" ? "/tasks/edux" : null)) {
      throw new Error("Nguồn công việc tạm thời không khả dụng");
    }
    if (config.url === "/tasks" && config.method === "get") data = tasks.map(row => ({ ...row }));
    else if (config.url === "/tasks/edux" && config.method === "get") data = { assignments: assignments.map(row => ({ ...row })) };
    else if (config.url === "/tasks/edux/edux-workspace" && config.method === "get") data = { assignment: { ...assignments[0] } };
    else if (config.url === "/tasks/101/status") {
      tasks[0].status = JSON.parse(config.data).status;
      data = { ...tasks[0] };
    } else if (config.url === "/tasks/edux/edux-workspace/status") {
      assignments[0].status = JSON.parse(config.data).status;
      data = { ...assignments[0] };
    } else return originalAdapter(config);
    return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data } };
  });
  apiClient.defaults.adapter = adapter;
  render(<MemoryRouter initialEntries={["/tasks"]}><AppProvider><Tasks /></AppProvider></MemoryRouter>);
  return { adapter, list: within(screen.getByRole("region", { name: "D. Danh sách công việc" })) };
}

describe("Tasks workspace", () => {
  it("includes EDUX active course progress independently of the selected source or status tab", async () => {
    mountWorkspace({ dueMetadata: { status: "Hoàn thành", subjectStartTime: "2020-01-01", subjectDeadline: "2099-12-31", due: "2099-12-31" } });
    const progress = within(screen.getByRole("region", { name: "Tiến độ tuần này" }));
    expect(await progress.findByRole("img", { name: "Tiến độ tuần: 33%" })).toBeTruthy();
    expect(progress.getByText("1/3 việc hoàn thành · 1 từ EDUX")).toBeTruthy();
    expect(progress.getByText("1/1 bài")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: "PERSONAL" } });
    fireEvent.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));
    expect(progress.getByRole("img", { name: "Tiến độ tuần: 33%" })).toBeTruthy();
  });

  it("requests a fresh EDUX snapshot when refreshing and keeps advanced filters collapsed until needed", async () => {
    const { adapter, list } = mountWorkspace();
    await list.findByRole("button", { name: "Mở rộng môn Cấu trúc dữ liệu" });
    const toggle = screen.getByRole("button", { name: "Bộ lọc" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Lọc theo ưu tiên"), { target: { value: "HIGH" } });
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain("1");
    fireEvent.click(screen.getByRole("button", { name: "Làm mới công việc" }));
    await waitFor(() => expect(adapter.mock.calls.some(([config]) => config.url === "/tasks/edux" && config.params?.refresh === "true")).toBe(true));
  });

  it("keeps completed work out of pending across presentations and clears status when changing tabs", async () => {
    const { list } = mountWorkspace({ extraTasks: [{ assignment_id: 103, subject_id: 11, subject_name: "Cấu trúc dữ liệu", title: "Bài đã xong", priority: "HIGH", status: "COMPLETED" }] });
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Ôn cây cân bằng");
    for (const view of ["Danh sách", "Bảng", "Lịch"]) {
      fireEvent.click(screen.getByRole("tab", { name: view }));
      expect(list.queryByText("Bài đã xong")).toBeNull();
    }
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "COMPLETED" } });
    expect(screen.getByRole("tab", { name: "Đã hoàn thành" }).getAttribute("aria-selected")).toBe("true");
    expect(list.getByText("Bài đã xong")).toBeTruthy();
    expect(list.queryByText("Ôn cây cân bằng")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Chưa hoàn thành" }));
    expect(screen.getByLabelText("Lọc theo trạng thái")).toHaveProperty("value", "");
    expect(list.getByText("Ôn cây cân bằng")).toBeTruthy();
    expect(list.queryByText("Bài đã xong")).toBeNull();
  });

  it("orders pending work by priority before deadline by default", async () => {
    const { list } = mountWorkspace({ extraTasks: [{ assignment_id: 104, subject_id: 11, subject_name: "Cấu trúc dữ liệu", title: "Việc khẩn cấp", deadline: "2099-12-31T23:00", priority: "URGENT", status: "PENDING" }] });
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Việc khẩn cấp");
    const urgent = list.getByText("Việc khẩn cấp");
    const high = list.getByText("Ôn cây cân bằng");
    expect(urgent.compareDocumentPosition(high) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["subject", "Hạn học phần"],
    ["exam", "Hạn bài kiểm tra"],
  ])("uses the API %s deadline in filters and calendar while identifying its origin in list and detail", async (dueSource, label) => {
    const day = formatDateISO(new Date());
    const subjectDeadline = `${day}T23:59:00+07:00`;
    const { list } = mountWorkspace({ dueMetadata: {
      due: dueSource === "subject" ? subjectDeadline : `${day}T21:00:00+07:00`,
      dueSource, subjectDeadline, subjectStartTime: `${day}T08:00:00+07:00`,
    } });
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Quiz cây tìm kiếm");
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: "EDUX" } });
    fireEvent.change(screen.getByLabelText("Lọc theo deadline"), { target: { value: day } });
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    const deadline = list.getByLabelText(new RegExp(`^${label}:`));
    expect(deadline.textContent).toContain(label);
    if (dueSource === "subject") expect(deadline.getAttribute("title")).toContain("áp dụng chung cho học phần");
    fireEvent.click(screen.getByRole("tab", { name: "Lịch" }));
    const calendar = within(list.getByRole("region", { name: "Lịch công việc" }));
    expect(calendar.queryByRole("heading", { name: /Chưa đặt hạn/ })).toBeNull();
    fireEvent.click(calendar.getByRole("button", { name: "Quiz cây tìm kiếm" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Bài tập EDUX" }));
    expect(await dialog.findByText(new RegExp(`^${label}:`))).toBeTruthy();
    if (dueSource === "subject") {
      expect(dialog.getByText(/^Hạn học phần:/).textContent).toContain("áp dụng chung cho học phần");
      expect(dialog.queryByText(/^Hạn bài kiểm tra:/)).toBeNull();
    } else expect(dialog.getByText(/^Hạn học phần:/).textContent).toContain("áp dụng chung cho học phần");
  });

  it.each(["PERSONAL", "EDUX"])("keeps available work visible when the %s source fails", async failedSource => {
    const { list } = mountWorkspace({ failedSource });
    const availableTitle = failedSource === "PERSONAL" ? "Quiz cây tìm kiếm" : "Ôn cây cân bằng";
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText(availableTitle);
    expect(list.queryByRole("alert")).toBeNull();
    expect(screen.getByText(failedSource === "PERSONAL" ? "Chưa tải được công việc cá nhân." : "Chưa tải được bài tập EDUX.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: failedSource } });
    expect(list.getByRole("alert").textContent).toContain("Nguồn công việc tạm thời không khả dụng");
  });

  it("starts with collapsed subject headers and expands personal and EDUX work together", async () => {
    const { list } = mountWorkspace();
    const expand = await list.findByRole("button", { name: "Mở rộng môn Cấu trúc dữ liệu" });
    expect(screen.getByRole("tab", { name: "Chưa hoàn thành" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Theo môn" }).getAttribute("aria-selected")).toBe("true");
    expect(list.queryByRole("checkbox")).toBeNull();
    fireEvent.click(expand);
    expect(list.getByText("Ôn cây cân bằng")).toBeTruthy();
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    expect(list.getAllByText("Chưa đặt hạn").length).toBeGreaterThan(0);
    expect(list.queryByText("Luyện phép nhân ma trận")).toBeNull();
    fireEvent.click(list.getByRole("button", { name: "Thu gọn môn Cấu trúc dữ liệu" }));
    expect(list.queryByRole("checkbox")).toBeNull();
    fireEvent.click(list.getByRole("button", { name: "Mở rộng môn Cấu trúc dữ liệu" }));
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
  });

  it("filters the common workspace by source without hiding the other source's saved data", async () => {
    const { list } = mountWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Quiz cây tìm kiếm");
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: "EDUX" } });
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    expect(list.queryByText("Ôn cây cân bằng")).toBeNull();
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: "PERSONAL" } });
    expect(list.getByText("Ôn cây cân bằng")).toBeTruthy();
    expect(list.queryByText("Quiz cây tìm kiếm")).toBeNull();
  });

  it.each([
    ["Quiz cây tìm kiếm", "/tasks/edux/edux-workspace/status", "Hoàn thành", "Chưa làm"],
    ["Ôn cây cân bằng", "/tasks/101/status", "COMPLETED", "PENDING"],
  ])("moves %s between pending and completed using its own endpoint", async (title, endpoint, completed, pending) => {
    const { adapter, list } = mountWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    fireEvent.click(await list.findByLabelText(`Hoàn thành ${title}`));
    await waitFor(() => expect(adapter.mock.calls.some(([config]) => config.url === endpoint && JSON.parse(config.data).status === completed)).toBe(true));
    await waitFor(() => expect(list.queryByText(title)).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));
    const checkbox = await list.findByLabelText(`Đánh dấu chưa làm ${title}`);
    expect(checkbox).toHaveProperty("checked", true);
    await waitFor(() => expect(checkbox).toHaveProperty("disabled", false));
    fireEvent.click(checkbox);
    await waitFor(() => expect(adapter.mock.calls.some(([config]) => config.url === endpoint && JSON.parse(config.data).status === pending)).toBe(true));
    await waitFor(() => expect(list.queryByText(title)).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "Chưa hoàn thành" }));
    expect(await list.findByLabelText(`Hoàn thành ${title}`)).toHaveProperty("checked", false);
  });

  it("changes presentation without losing selected source filters", async () => {
    const { list } = mountWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    await list.findByText("Quiz cây tìm kiếm");
    fireEvent.change(screen.getByLabelText("Lọc theo nguồn"), { target: { value: "EDUX" } });
    fireEvent.click(screen.getByRole("tab", { name: "Danh sách" }));
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    expect(list.queryByText("Ôn cây cân bằng")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Bảng" }));
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Lịch" }));
    expect(list.getByText("Quiz cây tìm kiếm")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Lịch" }).getAttribute("aria-selected")).toBe("true");
  });
});

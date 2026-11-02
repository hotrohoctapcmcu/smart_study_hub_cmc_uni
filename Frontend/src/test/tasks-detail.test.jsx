import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Tasks from "../pages/Tasks/Tasks";
import apiClient from "../api/apiClient";

const adapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = adapter; });
function Location() { const location = useLocation(); return <output aria-label="Địa chỉ">{location.pathname + location.search}</output>; }
function mount(url) {
  return render(<MemoryRouter initialEntries={[url]}><AppProvider><Tasks /><Location /></AppProvider></MemoryRouter>);
}
describe("Task details", () => {
  it("opens a task from its search URL, edits checklist inline and clears the URL when closed", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    mount("/tasks?task=1");
    await screen.findByRole("dialog");
    fireEvent.click(await screen.findByRole("button", { name: "Sửa checklist" }));
    fireEvent.change(screen.getByLabelText("Tên bước checklist"), { target: { value: "Đọc chương tiếp theo" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu checklist" }));
    expect(await screen.findByText("Đọc chương tiếp theo")).toBeTruthy();
    expect(spy.mock.calls.some(([c]) => c.url === "/tasks/checklist/1" && c.method === "put")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Địa chỉ").textContent).toBe("/tasks");
  });

  it("opens the real EDUX detail envelope and saves tags through its existing endpoint", async () => {
    const assignment = { id: "edux-search", title: "Bài tập đại số", subject: "Đại số", status: "Đang làm", progress: { daHoc: 2, tongSo: 5 }, highestScore: 0, description: "Ôn tập ma trận", tags: ["Cần ôn"] };
    const spy = vi.fn(async (config) => {
      if (config.url === "/tasks/edux/edux-search") return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data: { source: "EDUX", assignment } } };
      if (config.url === "/tags/edux/edux-search") return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data: assignment } };
      return adapter(config);
    });
    apiClient.defaults.adapter = spy;
    mount("/tasks?edux=edux-search");
    expect(await screen.findByText("Ôn tập ma trận")).toBeTruthy();
    expect(screen.getByText("Tiến độ: 2/5")).toBeTruthy();
    expect(screen.getByText("Điểm cao nhất: 0")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tag EDUX (phân cách bằng dấu phẩy)"), { target: { value: "Quan trọng, Cần ôn, Quan trọng" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu tag EDUX" }));
    await waitFor(() => expect(spy.mock.calls.some(([c]) => c.url === "/tags/edux/edux-search")).toBe(true));
    const config = spy.mock.calls.find(([c]) => c.url === "/tags/edux/edux-search")[0];
    expect(JSON.parse(config.data)).toEqual({ tags: ["Quan trọng", "Cần ôn"] });
  });
});

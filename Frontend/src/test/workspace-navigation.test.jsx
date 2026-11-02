import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import apiClient from "../api/apiClient";
import WorkspaceSearch from "../components/layout/WorkspaceSearch";
import AppLayout from "../components/layout/AppLayout";
import { layoutDayEvents } from "../components/schedule/WeeklyCalendar";
import { GreetingBanner } from "../components/dashboard/Widgets";

const originalAdapter = apiClient.defaults.adapter;
const originalMatchMedia = window.matchMedia;
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  window.matchMedia = originalMatchMedia;
});
const response = (config, data) => ({ config, data: { success: true, data }, status: 200, headers: {} });
function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>; }
function mountSearch() {
  return render(<MemoryRouter><WorkspaceSearch isOpen onClose={() => {}} /><Location /></MemoryRouter>);
}

describe("Workspace navigation", () => {
  it("groups the real flat search response and opens the selected task", async () => {
    apiClient.defaults.adapter = async (config) => response(config, [
      { id: "7", type: "task", title: "Bài tập cần mở", preview: "Đọc chương 3" },
      { id: "class-4", type: "schedule", title: "Lịch C#", selectedDate: "2026-10-29" },
    ]);
    mountSearch();
    expect(document.activeElement).toBe(screen.getByLabelText("Tìm kiếm toàn bộ"));
    fireEvent.change(screen.getByLabelText("Tìm kiếm toàn bộ"), { target: { value: "chương" } });
    await screen.findByText("Bài tập cần mở");
    expect(screen.getByRole("heading", { name: /Lịch học/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bài tập cần mở/ }));
    expect(screen.getByTestId("location").textContent).toBe("/tasks?task=7");
  });

  it("hides an old result as soon as the query changes", async () => {
    const pending = {};
    apiClient.defaults.adapter = (config) => new Promise((resolve) => {
      pending[config.params.q] = () => resolve(response(config, [{ id: 1, type: "task", title: config.params.q + " result" }]));
    });
    mountSearch();
    const input = screen.getByLabelText("Tìm kiếm toàn bộ");
    fireEvent.change(input, { target: { value: "first" } });
    await waitFor(() => expect(pending.first).toBeTypeOf("function"));
    fireEvent.change(input, { target: { value: "second" } });
    await act(async () => pending.first());
    expect(screen.queryByText("first result")).toBeNull();
    await waitFor(() => expect(pending.second).toBeTypeOf("function"));
    await act(async () => pending.second());
    expect(await screen.findByText("second result")).toBeTruthy();
  });

  it("keeps keyboard focus inside the mobile drawer and restores the menu button", async () => {
    window.matchMedia = vi.fn((query) => ({ matches: query === "(max-width: 1199px)", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<MemoryRouter><AppLayout /></MemoryRouter>);
    const sidebar = document.getElementById("main-sidebar");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    const menu = screen.getByRole("button", { name: "Mở menu" });
    menu.focus();
    fireEvent.click(menu);
    expect(sidebar.getAttribute("role")).toBe("dialog");
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByLabelText("Tìm kiếm toàn bộ")).toBeNull();
    const links = sidebar.querySelectorAll("a[href], button:not(:disabled)");
    links[links.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(menu);
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
  });

  it("never shows a later request under a previously searched keyword", async () => {
    const pending = {};
    apiClient.defaults.adapter = (config) => new Promise((resolve) => {
      pending[config.params.q] = () => resolve(response(config, [{ id: 1, type: "task", title: config.params.q + " result" }]));
    });
    mountSearch();
    const input = screen.getByLabelText("Tìm kiếm toàn bộ");
    fireEvent.change(input, { target: { value: "first" } });
    await waitFor(() => expect(pending.first).toBeTypeOf("function"));
    await act(async () => pending.first());
    await screen.findByText("first result");
    fireEvent.change(input, { target: { value: "second" } });
    await waitFor(() => expect(pending.second).toBeTypeOf("function"));
    fireEvent.change(input, { target: { value: "first" } });
    await act(async () => pending.second());
    expect(screen.queryByText("second result")).toBeNull();
    expect(screen.queryAllByLabelText("Đang tải dữ liệu").length).toBeGreaterThan(0);
  });

  it("accepts an absent profile without crashing the dashboard greeting", () => {
    render(<GreetingBanner profile={null} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("bạn");
  });
});

describe("Overlapping class and study sessions", () => {
  it("gives overlapping events separate lanes and reuses the full width later", () => {
    const rows = [
      { id: 1, startTime: "08:00", endTime: "10:00" },
      { id: 2, startTime: "09:00", endTime: "11:00" },
      { id: 3, startTime: "10:00", endTime: "12:00" },
      { id: 4, startTime: "12:00", endTime: "13:00" },
    ];
    const result = layoutDayEvents(rows);
    expect(result.map(({ lane, laneCount }) => [lane, laneCount])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
    expect(rows[0]).not.toHaveProperty("lane");
  });
});

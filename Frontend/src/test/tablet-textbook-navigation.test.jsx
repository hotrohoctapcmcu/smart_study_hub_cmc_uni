import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import TextbookEditor from "../pages/Textbook/TextbookEditor";
import { createBook, getBook, setTextbookOwner } from "../utils/textbookStore";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
  localStorage.clear();
  setTextbookOwner("device");
});

describe("Tablet navigation with an unsaved notebook", () => {
  it("closes the app drawer and exposes the save guard when storage fails", async () => {
    localStorage.clear();
    setTextbookOwner("device");
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const book = createBook({ title: "Bản nháp trên tablet" });
    const router = createMemoryRouter([{ path: "/", element: <AppLayout />, children: [
      { path: "textbook/:id", element: <TextbookEditor /> },
      { path: "tasks", element: <h1>Trang công việc đã mở</h1> },
    ] }], { initialEntries: [`/textbook/${book.id}`] });
    render(<RouterProvider router={router} />);
    await screen.findByRole("img", { name: /Canvas/ });
    await waitFor(() => expect(screen.getByRole("button", { name: "Tài khoản sinh viên" })).toBeTruthy());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    fireEvent.click(screen.getByRole("button", { name: "Trang mới" }));
    expect(await screen.findByText(/Nội dung vẫn ở trong phiên này/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    const sidebar = document.getElementById("main-sidebar");
    expect(sidebar.getAttribute("role")).toBe("dialog");
    fireEvent.click(within(sidebar).getByRole("link", { name: "Công việc" }));
    const guard = await screen.findByRole("dialog", { name: "Nội dung chưa được lưu" });
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(document.querySelector(".app-workspace").hasAttribute("inert")).toBe(false);
    expect(document.querySelector(".sidebar-backdrop")).toBeNull();
    expect(router.state.location.pathname).toBe(`/textbook/${book.id}`);
    expect(guard.closest("[inert]")).toBeNull();
    fireEvent.click(within(guard).getByRole("button", { name: "Ở lại" }));
    expect(screen.getByRole("img", { name: /Canvas Trang 2/ })).toBeTruthy();
    expect(getBook(book.id).pages).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    fireEvent.click(within(sidebar).getByRole("link", { name: "Công việc" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Rời đi và bỏ thay đổi chưa lưu" })));
    expect(router.state.location.pathname).toBe("/tasks");
    expect(screen.getByText("Trang công việc đã mở")).toBeTruthy();
    router.dispose();
  });
});

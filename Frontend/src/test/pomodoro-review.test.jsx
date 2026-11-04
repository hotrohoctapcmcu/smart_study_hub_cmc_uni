import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Learning from "../pages/Learning/Learning";
import apiClient from "../api/apiClient";

const originalAdapter = apiClient.defaults.adapter;
let requests;
beforeEach(() => {
  requests = vi.fn(async config => ({ config, status: 200, headers: {}, data: { success: true, data:
    config.url === '/sync/current-courses' ? { resolved: true, courses: [{ subjectId: 1, subjectName: 'SQL' }] }
      : config.url === "/learning/courses" ? { courses: [{ id: "sql", subject: "SQL" }, { id: "web", subject: "Web" }] }
      : config.url === "/learning/courses/sql" ? { cards: [{ id: "sql-1", front: "Câu hỏi SQL", back: "Đáp án SQL", chapter: 'JOIN' }] }
        : config.url === "/learning/courses/web" ? { cards: [{ id: "web-1", front: "Câu hỏi Web", back: "Đáp án Web" }] } : [] } }));
  apiClient.defaults.adapter = requests;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });
function mount(url) { return render(<MemoryRouter initialEntries={[url]}><AppProvider><Learning /></AppProvider></MemoryRouter>); }

describe("Review after a focused session", () => {
  it("filters flashcards to the selected subject and can show all subjects again", async () => {
    mount("/learning?tab=flashcards&subject=SQL&topic=JOIN");
    await screen.findByText("Câu hỏi SQL");
    expect(screen.queryByRole("option", { name: /Web/ })).toBeNull();
    expect(screen.getByText(/Ôn lại môn SQL/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả môn" }));
    await screen.findByRole("option", { name: /Web/ });
  });
  it("prefills the quiz subject and goal without automatically calling AI", async () => {
    const view = mount("/learning?tab=quiz&subject=SQL&topic=Luy%E1%BB%87n%20JOIN");
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
    expect(requests.mock.calls.some(([config]) => config.method === "post")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Tạo quiz" }));
    await screen.findByRole('option', { name: 'SQL' });
    expect(screen.getByLabelText("Môn học / chủ đề").value).toBe("SQL");
    expect(screen.getByLabelText("Chủ đề ôn tập").value).toBe("Luyện JOIN");
    view.unmount();
    mount(`/learning?tab=quiz&subject=${"s".repeat(200)}&topic=${"t".repeat(300)}`);
    fireEvent.click(screen.getByRole("button", { name: "Tạo quiz" }));
    expect(screen.getByLabelText("Môn học / chủ đề").value).toBe('');
    expect(screen.getByLabelText("Chủ đề ôn tập").value).toHaveLength(180);
  });
});

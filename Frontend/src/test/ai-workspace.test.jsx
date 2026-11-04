import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import AITutor, { ChatInput } from "../pages/AITutor/AITutor";
import { aiApi, progressApi, syncApi, examApi } from "../api";

const response = (data) => ({ config: {}, data: { success: true, data } });
const answer = (conversationId = "existing-conversation") =>
  response({ answer: "Phản hồi kiểm thử", conversationId });
function mount() {
  return render(<MemoryRouter><AppProvider><AITutor /></AppProvider></MemoryRouter>);
}
function enter(text) {
  fireEvent.change(screen.getByLabelText("Tin nhắn cho AI Tutor"), {
    target: { value: text },
  });
}
function send() {
  fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
}
function choose(tool) {
  fireEvent.change(screen.getByLabelText("Công cụ AI"), {
    target: { value: tool },
  });
}
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(syncApi, 'currentCourses').mockResolvedValue(response({ resolved: true, courses: [{ subjectId: 1, subjectName: 'CSDL' }] }));
  vi.spyOn(examApi, 'list').mockResolvedValue(response([{ exam_id: 'exam-7', subject_name: 'CSDL', exam_date: '2099-11-06', exam_time: '08:00' }]));
});

describe("AI Tutor workspace preserves existing behavior", () => {
  it('expands the reading area and keeps the answer, selected subject and unsent draft', async () => {
    const ask = vi.spyOn(aiApi, 'ask').mockResolvedValue(response({ answer: 'Nội dung chi tiết cần đọc', conversationId: 'reading-chat' }));
    mount();
    await screen.findByRole('option', { name: 'CSDL' });
    fireEvent.change(screen.getByLabelText('Môn kỳ hiện tại'), { target: { value: 'CSDL' } });
    enter('Giải thích bài học'); send();
    await screen.findByText('Nội dung chi tiết cần đọc');
    enter('Câu hỏi tiếp theo chưa gửi');
    fireEvent.click(screen.getByRole('button', { name: 'Chế độ đọc' }));
    expect(screen.getByRole('button', { name: 'Thoát chế độ đọc' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Tin nhắn cho AI Tutor' })).toBeNull();
    expect(screen.queryByLabelText('Môn kỳ hiện tại', { selector: 'select:not([hidden])' })?.closest('[hidden]')).toBeTruthy();
    expect(screen.getByText('Nội dung chi tiết cần đọc')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('tabpanel'), { key: 'Escape' });
    expect(screen.getByLabelText('Tin nhắn cho AI Tutor').value).toBe('Câu hỏi tiếp theo chưa gửi');
    expect(screen.getByLabelText('Môn kỳ hiện tại').value).toBe('CSDL');
    expect(ask).toHaveBeenCalledOnce();
  });
  it("supports manual tab focus navigation without replacing a draft", () => {
    mount();
    enter("Bản nháp đang viết");
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[4]);
    fireEvent.keyDown(tabs[4], { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(document.activeElement).toBe(tabs[4]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Tin nhắn cho AI Tutor").value).toBe("Bản nháp đang viết");
    // jsdom does not synthesize the browser's native Enter-to-click default.
    // Leave Enter unhandled so native button activation remains available.
    expect(fireEvent.keyDown(tabs[4], { key: "Enter" })).toBe(true);
    fireEvent.click(tabs[4]);
    expect(tabs[4].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[4].id);
    expect(screen.getByLabelText("Tin nhắn cho AI Tutor").value).toMatch(/^Lập kế hoạch học tập/);
    const details = screen.getByText("Tùy chọn công cụ").closest("details");
    expect(details.open).toBe(false);
    fireEvent.click(details.querySelector("summary"));
    expect(details.open).toBe(true);
    expect(screen.getByLabelText("Từ ngày")).toBeTruthy();
    expect(screen.getByLabelText("Đến ngày")).toBeTruthy();
  });

  it("keeps Shift+Enter and composing Enter from submitting", () => {
    const onSend = vi.fn();
    render(<ChatInput value="Nội dung" onChange={() => {}} onSend={onSend} busy={false} />);
    const input = screen.getByLabelText("Tin nhắn cho AI Tutor");
    expect(fireEvent.keyDown(input, { key: "Enter", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onSend).toHaveBeenCalledOnce();
  });

  it.each([
    ["Giải thích bài", "Giải thích dễ hiểu giúp tôi về"],
    ["Tạo câu hỏi", "Tạo câu hỏi ôn tập về"],
  ])("keeps %s using the real ask contract", async (label, prompt) => {
    const ask = vi.spyOn(aiApi, "ask").mockResolvedValue(answer());
    mount();
    fireEvent.click(screen.getByRole("tab", { name: label }));
    send();
    await waitFor(() => expect(ask).toHaveBeenCalledWith({
      question: prompt, conversationId: null,
    }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(await screen.findByText("Phản hồi kiểm thử")).toBeTruthy();
    enter("Câu hỏi tiếp theo");
    send();
    await waitFor(() => expect(ask).toHaveBeenLastCalledWith({
      question: "Câu hỏi tiếp theo", conversationId: "existing-conversation",
    }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  it("retains every existing tool and its structured options", async () => {
    const check = vi.spyOn(aiApi, "check").mockResolvedValue(answer());
    const leave = vi.spyOn(aiApi, "draftLeave").mockResolvedValue(answer());
    const progress = vi.spyOn(progressApi, "getProgress").mockResolvedValue(
      response({ metrics: { subjects: [{ subjectName: "CSDL" }] } }),
    );
    const advice = vi.spyOn(aiApi, "progressAdvice").mockResolvedValue(answer());
    const difficult = vi.spyOn(aiApi, "difficultNotes").mockResolvedValue(answer());
    mount();
    expect([...screen.getByLabelText("Công cụ AI").options].map((o) => o.value))
      .toEqual(["ask", "plan", "examPlan", "check", "summarize", "draftLeave", "progressAdvice", "difficultNotes"]);
    choose("check");
    fireEvent.change(screen.getByLabelText("Câu hỏi cần kiểm tra"), { target: { value: "Đề bài" } });
    enter("Đáp án"); send();
    await waitFor(() => expect(check).toHaveBeenCalledWith({ question: "Đề bài", answer: "Đáp án" }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("draftLeave");
    await screen.findAllByRole('option', { name: 'CSDL' });
    fireEvent.change(screen.getByLabelText("Ngày nghỉ"), { target: { value: "2026-11-02" } });
    fireEvent.change(screen.getByLabelText("Người nhận (tùy chọn)"), { target: { value: "Giảng viên" } });
    fireEvent.change(screen.getByLabelText("Môn học (tùy chọn)"), { target: { value: "CSDL" } });
    enter("Lý do nghỉ"); send();
    await waitFor(() => expect(leave).toHaveBeenCalledWith({ date: "2026-11-02", recipient: "Giảng viên", subject: "CSDL", reason: "Lý do nghỉ" }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("progressAdvice"); enter("Tư vấn giúp tôi"); send();
    await waitFor(() => expect(advice).toHaveBeenCalledWith({ progress: { subjects: [{ subjectName: "CSDL" }] } }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(progress).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("difficultNotes"); enter("Phân tích phần khó"); send();
    await waitFor(() => expect(difficult).toHaveBeenCalledWith({}, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  it.each(["plan", "examPlan"])("keeps %s as a preview until explicit confirmation", async (tool) => {
    const sessions = [{ title: "Ôn CSDL", date: "2026-11-02", start: "19:00", end: "20:00" }];
    const phases = [{ title: "Ôn tập", startDate: "2026-11-02", endDate: "2026-11-08" }];
    const preview = vi.spyOn(aiApi, tool).mockResolvedValue(response({ answer: "Kế hoạch xem trước", sessions, phases }));
    const confirm = vi.spyOn(aiApi, tool === "plan" ? "confirmPlan" : "confirmExamPlan").mockResolvedValue(response({ persisted: true }));
    mount();
    choose(tool);
    if (tool === "examPlan") {
      await screen.findByRole('option', { name: /CSDL.*2099-11-06/ });
      fireEvent.change(screen.getByLabelText("Kỳ thi sắp tới"), { target: { value: "exam-7" } });
    } else {
      await screen.findAllByRole('option', { name: 'CSDL' });
      fireEvent.change(screen.getByLabelText("Mỗi buổi (phút)"), { target: { value: "90" } });
      fireEvent.change(screen.getByLabelText("Môn ưu tiên (tùy chọn)"), { target: { value: "CSDL" } });
    }
    enter("Lập kế hoạch"); send();
    const button = await screen.findByRole("button", { name: "Xác nhận kế hoạch" });
    expect(confirm).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith(tool === "examPlan" ? { examId: "exam-7" } : expect.objectContaining({ durationMinutes: 90, subject: "CSDL", freeStartTime: "19:00", freeEndTime: "22:00" }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const updated = vi.fn();
    window.addEventListener("workspace-updated", updated);
    try {
      fireEvent.click(button);
      await screen.findByText("Đã xác nhận kế hoạch");
      expect(confirm).toHaveBeenCalledWith(tool === "plan" ? { confirmed: true, sessions } : { confirmed: true, requestId: expect.any(String), sessions, phases });
      expect(button.disabled).toBe(true);
      expect(updated).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("workspace-updated", updated);
    }
  });

  it("blocks duplicate sends and restores failed input for retry", async () => {
    let reject;
    const pending = new Promise((_, failure) => { reject = failure; });
    const ask = vi.spyOn(aiApi, "ask").mockReturnValueOnce(pending).mockResolvedValue(answer());
    mount();
    expect(screen.getByRole("heading", { name: "Bạn muốn học gì hôm nay?" })).toBeTruthy();
    enter("Câu hỏi cần giữ lại"); send();
    expect(screen.queryByRole("heading", { name: "Bạn muốn học gì hôm nay?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" }).disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Tin nhắn cho AI Tutor"), { key: "Enter" });
    await waitFor(() => expect(ask).toHaveBeenCalledOnce());
    reject(new Error("AI đang bận"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("AI đang bận"));
    expect(screen.getByLabelText("Tin nhắn cho AI Tutor").value).toBe("Câu hỏi cần giữ lại");
    send();
    expect(await screen.findByText("Phản hồi kiểm thử")).toBeTruthy();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
    expect(screen.queryByText("Phản hồi kiểm thử")).toBeNull();
    expect(screen.getByRole("heading", { name: "Bạn muốn học gì hôm nay?" })).toBeTruthy();
    enter("Bắt đầu lại"); send();
    await waitFor(() => expect(ask).toHaveBeenLastCalledWith({ question: "Bắt đầu lại", conversationId: null }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });
  it('stops a pending chat, restores the question and ignores an answer arriving after cancellation', async () => {
    let late;
    const ask = vi.spyOn(aiApi, 'ask').mockImplementationOnce(() => new Promise(resolve => { late = resolve; })).mockResolvedValue(answer('retry-chat'));
    mount();
    enter('Câu hỏi bị chậm'); send();
    await waitFor(() => expect(ask).toHaveBeenCalledOnce());
    const signal = ask.mock.calls[0][1].signal;
    fireEvent.click(screen.getByRole('button', { name: 'Dừng yêu cầu' }));
    await screen.findByRole('alert');
    expect(signal.aborted).toBe(true);
    expect(screen.getByLabelText('Tin nhắn cho AI Tutor').value).toBe('Câu hỏi bị chậm');
    expect(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }).disabled).toBe(false);
    await act(async () => late(response({ answer: 'Phản hồi đến muộn' })));
    expect(screen.queryByText('Phản hồi đến muộn')).toBeNull();
    send();
    expect(await screen.findByText('Phản hồi kiểm thử')).toBeTruthy();
    expect(ask).toHaveBeenCalledTimes(2);
  });
  it('aborts the pending request when leaving AI Tutor', async () => {
    const ask = vi.spyOn(aiApi, 'ask').mockReturnValue(new Promise(() => {}));
    const page = mount();
    enter('Câu hỏi đang gửi'); send();
    await waitFor(() => expect(ask).toHaveBeenCalledOnce());
    const signal = ask.mock.calls[0][1].signal;
    page.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('shows a slow-response notice and unlocks the composer when its deadline expires', async () => {
    vi.spyOn(aiApi, 'status').mockResolvedValue(response({ available: true }));
    const ask = vi.spyOn(aiApi, 'ask').mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();
    try {
      mount(); enter('Câu hỏi quá hạn'); send();
      await act(async () => { await Promise.resolve(); });
      expect(ask).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(screen.getByText('AI đang phản hồi chậm. Bạn có thể dừng yêu cầu và thử lại.')).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(105000); });
      expect(screen.getByRole('alert').textContent).toContain('thời gian chờ');
      expect(ask.mock.calls[0][1].signal.aborted).toBe(true);
      expect(screen.getByLabelText('Tin nhắn cho AI Tutor').value).toBe('Câu hỏi quá hạn');
      expect(screen.getByRole('button', { name: 'Gửi tin nhắn' }).disabled).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('does not report an unchecked provider as ready', async () => {
    vi.spyOn(aiApi, 'status').mockResolvedValue(response({ ready: false, available: null, connection: 'unchecked' }));
    mount();
    expect(await screen.findByText('Chưa kiểm tra kết nối AI')).toBeTruthy();
    expect(screen.queryByText('Sẵn sàng cùng bạn học tập')).toBeNull();
  });
});

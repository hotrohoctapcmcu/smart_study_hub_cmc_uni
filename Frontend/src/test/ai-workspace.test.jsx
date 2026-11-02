import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import AITutor, { ChatInput } from "../pages/AITutor/AITutor";
import { aiApi, progressApi } from "../api";

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

describe("AI Tutor workspace preserves existing behavior", () => {
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
    }));
    expect(await screen.findByText("Phản hồi kiểm thử")).toBeTruthy();
    enter("Câu hỏi tiếp theo");
    send();
    await waitFor(() => expect(ask).toHaveBeenLastCalledWith({
      question: "Câu hỏi tiếp theo", conversationId: "existing-conversation",
    }));
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
    await waitFor(() => expect(check).toHaveBeenCalledWith({ question: "Đề bài", answer: "Đáp án" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("draftLeave");
    fireEvent.change(screen.getByLabelText("Ngày nghỉ"), { target: { value: "2026-11-02" } });
    fireEvent.change(screen.getByLabelText("Người nhận (tùy chọn)"), { target: { value: "Giảng viên" } });
    fireEvent.change(screen.getByLabelText("Môn học (tùy chọn)"), { target: { value: "CSDL" } });
    enter("Lý do nghỉ"); send();
    await waitFor(() => expect(leave).toHaveBeenCalledWith({ date: "2026-11-02", recipient: "Giảng viên", subject: "CSDL", reason: "Lý do nghỉ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("progressAdvice"); enter("Tư vấn giúp tôi"); send();
    await waitFor(() => expect(advice).toHaveBeenCalledWith({ progress: { subjects: [{ subjectName: "CSDL" }] } }));
    expect(progress).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }).disabled).toBe(false));
    choose("difficultNotes"); enter("Phân tích phần khó"); send();
    await waitFor(() => expect(difficult).toHaveBeenCalledWith({}));
  });

  it.each(["plan", "examPlan"])("keeps %s as a preview until explicit confirmation", async (tool) => {
    const sessions = [{ title: "Ôn CSDL", date: "2026-11-02", start: "19:00", end: "20:00" }];
    const phases = [{ title: "Ôn tập", startDate: "2026-11-02", endDate: "2026-11-08" }];
    const preview = vi.spyOn(aiApi, tool).mockResolvedValue(response({ answer: "Kế hoạch xem trước", sessions, phases }));
    const confirm = vi.spyOn(aiApi, tool === "plan" ? "confirmPlan" : "confirmExamPlan").mockResolvedValue(response({ persisted: true }));
    mount();
    choose(tool);
    if (tool === "examPlan") {
      fireEvent.change(screen.getByLabelText("Mã kỳ thi (để trống để ôn tất cả)"), { target: { value: "exam-7" } });
    } else {
      fireEvent.change(screen.getByLabelText("Mỗi buổi (phút)"), { target: { value: "90" } });
      fireEvent.change(screen.getByLabelText("Môn ưu tiên (tùy chọn)"), { target: { value: "CSDL" } });
    }
    enter("Lập kế hoạch"); send();
    const button = await screen.findByRole("button", { name: "Xác nhận kế hoạch" });
    expect(confirm).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith(tool === "examPlan" ? { examId: "exam-7" } : expect.objectContaining({ durationMinutes: 90, subject: "CSDL", freeStartTime: "19:00", freeEndTime: "22:00" }));
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
    expect(ask).toHaveBeenCalledOnce();
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
    await waitFor(() => expect(ask).toHaveBeenLastCalledWith({ question: "Bắt đầu lại", conversationId: null }));
  });
});

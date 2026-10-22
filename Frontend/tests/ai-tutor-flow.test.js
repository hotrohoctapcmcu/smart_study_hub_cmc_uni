/**
 * UniStudy CMC - AI Assistant Flow Test (chạy bằng node, không cần DOM)
 *
 * Kiểm tra nhánh FE của trợ lý AI ở mức logic thuần, dùng fetch giả lập:
 *  - askAssistant() đọc đúng { success, data: { answer } } của backend
 *  - lỗi backend -> { success: false, error } để view hiển thị
 *  - store giữ loading/error/hội thoại và gửi conversationId giữa các lượt
 *  - view có đủ trạng thái rỗng, loading, lỗi và nút gửi bị khoá khi chưa sẵn sàng
 *
 * Chạy: node tests/ai-tutor-flow.test.js (từ Frontend/)
 */

import { aiChatState, resetAiChat, loadAssistantStatus, beginQuestion, askCurrentQuestion } from "../src/features/ai-tutor/ai-tutor.store.js";
import { renderAiChatPanel } from "../src/features/ai-tutor/ai-tutor.view.js";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  PASS ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}`); }
}

console.log("== AI TUTOR FLOW (FE logic) ==");

// ─── fetch giả lập ───────────────────────────────────────────────────────
const calls = [];
let nextReply = null;

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
  const reply = typeof nextReply === "function" ? nextReply(url, options) : nextReply;
  return {
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    statusText: reply.statusText || "",
    json: async () => reply.json
  };
};

function traLoi(status, json) {
  nextReply = { status, json };
}

// 1. Trạng thái dịch vụ
resetAiChat();
traLoi(200, { success: true, data: { ready: true, model: "Trợ lý AI", message: "Trợ lý AI sẵn sàng." } });
await loadAssistantStatus();
ok(aiChatState.status === "ready", "status ready khi backend báo ready=true");
ok(aiChatState.statusMessage.includes("sẵn sàng"), "giữ message từ backend");

resetAiChat();
traLoi(200, { success: true, data: { ready: false, message: "Trợ lý AI chưa được cấu hình trên máy chủ." } });
await loadAssistantStatus();
ok(aiChatState.status === "unavailable", "status unavailable khi backend chưa cấu hình");
let html = renderAiChatPanel();
ok(html.includes('id="aiChatRetryBtn"'), "chưa cấu hình -> có nút kiểm tra lại");
ok(html.includes("chưa được cấu hình"), "chưa cấu hình -> hiện message backend");
ok(html.includes("disabled"), "chưa cấu hình -> ô nhập và nút gửi bị khoá");

// 2. Trạng thái rỗng (empty state) khi đã sẵn sàng và chưa hỏi gì
resetAiChat();
traLoi(200, { success: true, data: { ready: true } });
await loadAssistantStatus();
html = renderAiChatPanel();
ok(html.includes("ai-chat-empty"), "đã sẵn sàng, chưa có tin -> empty state");
ok(html.includes("data-ai-suggestion"), "empty state có gợi ý câu hỏi");
ok(!html.includes("disabled"), "đã sẵn sàng -> ô nhập mở khoá");

// 3. Gửi câu hỏi thành công
calls.length = 0;
traLoi(200, { success: true, data: { answer: "Đạo hàm là tốc độ thay đổi.", conversationId: aiChatState.conversationId } });
const cauHoi = beginQuestion("  Đạo hàm là gì?  ");
ok(cauHoi === "Đạo hàm là gì?", "cắt khoảng trắng đầu/cuối câu hỏi");
ok(aiChatState.pending === true, "bật loading ngay khi gửi");
html = renderAiChatPanel();
ok(html.includes("ai-typing"), "đang chờ -> hiện chỉ báo đang trả lời");

const res = await askCurrentQuestion(cauHoi);
ok(res.success === true, "gửi thành công");
ok(aiChatState.pending === false, "tắt loading sau khi có phản hồi");
ok(calls.length === 1 && calls[0].url.endsWith("/api/v1/ai/ask"), "gọi đúng endpoint /ai/ask");
ok(calls[0].body.question === "Đạo hàm là gì?", "body gửi đúng câu hỏi");
ok(typeof calls[0].body.conversationId === "string", "gửi kèm conversationId");

html = renderAiChatPanel();
ok(html.includes("Đạo hàm là gì?"), "hiện câu hỏi của người dùng");
ok(html.includes("Đạo hàm là tốc độ thay đổi."), "hiện câu trả lời của trợ lý");
ok(aiChatState.messages.length === 2, "hội thoại lưu đủ 2 lượt");

// 4. Lượt tiếp theo dùng lại conversationId
calls.length = 0;
traLoi(200, { success: true, data: { answer: "Ví dụ: f(x)=x²." } });
await askCurrentQuestion(beginQuestion("Cho ví dụ"));
ok(calls[0].body.conversationId === aiChatState.conversationId, "lượt sau giữ nguyên conversationId");

// 5. Lỗi từ backend
calls.length = 0;
traLoi(503, { success: false, message: "Trợ lý AI chưa được cấu hình trên máy chủ." });
const loi = await askCurrentQuestion(beginQuestion("Câu hỏi khi server lỗi"));
ok(loi.success === false, "lỗi backend -> trả success=false");
ok(aiChatState.pending === false, "lỗi không làm treo trạng thái loading");
ok(aiChatState.error.includes("chưa được cấu hình"), "giữ message lỗi của backend");
html = renderAiChatPanel();
ok(html.includes("ai-chat-error"), "hiện khối lỗi cho người dùng");
ok(html.includes("chưa được cấu hình"), "khối lỗi chứa nội dung lỗi");
ok(html.includes("Câu hỏi khi server lỗi"), "câu hỏi lỗi vẫn nằm trong hội thoại");

// 6. Chống gửi trùng khi đang chờ
resetAiChat();
aiChatState.status = "ready";
aiChatState.pending = true;
ok(beginQuestion("Gửi lần hai") === null, "đang chờ -> không nhận câu hỏi mới");
ok(aiChatState.messages.length === 0, "không thêm tin nhắn khi đang chờ");
aiChatState.pending = false;

// 7. Backend trả 200 nhưng thiếu answer
traLoi(200, { success: true, data: {} });
const rong = await askCurrentQuestion(beginQuestion("Câu hỏi lạ"));
ok(rong.success === false, "thiếu answer -> coi là lỗi");
ok(aiChatState.error.length > 0, "có thông báo lỗi rõ ràng");

// 8. Escape HTML trong câu trả lời
resetAiChat();
aiChatState.status = "ready";
aiChatState.messages.push({ role: "assistant", text: "<img src=x onerror=alert(1)>" });
html = renderAiChatPanel();
ok(!html.includes("<img src=x onerror"), "escape HTML trong câu trả lời");

console.log(`\n==== AI TUTOR FLOW: ${pass} PASS, ${fail} FAIL ====`);
if (fail) process.exit(1);

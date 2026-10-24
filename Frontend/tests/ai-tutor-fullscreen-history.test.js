/**
 * UniStudy CMC - Test Layout Toàn màn hình & Lịch sử Chat & Typing Indicator
 * ===================================================================================
 * Kiểm tra các yêu cầu:
 * 1. Cấu trúc Layout Toàn màn hình & Lịch sử Chat:
 *    - Render đủ Sidebar Lịch sử, nút "Đoạn chat mới", danh sách hội thoại cũ
 *    - Render Vùng Chat chính với header toggle, vùng cuộn tin nhắn và input bar
 * 2. Logic Hiển thị Tin nhắn Tức thời & Typing Indicator
 * 3. Không can thiệp vào Backend
 * ===================================================================================
 */
import {
  aiChatState,
  resetAiChat,
  createNewConversation,
  selectConversation,
  deleteConversation,
  syncCurrentConversationToHistory
} from "../src/features/ai-tutor/ai-tutor.store.js";
import { renderAiChatPanel, renderPendingBubble, renderHistoryList } from "../src/features/ai-tutor/ai-tutor.view.js";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  PASS ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}`); }
}

console.log("== AI TUTOR FULLSCREEN & HISTORY TEST ==");

// 1. Kiểm tra HTML Layout Toàn màn hình và Sidebar
resetAiChat();
aiChatState.status = "ready";
const html = renderAiChatPanel();

ok(html.includes('id="aiChatSidebar"'), "Có sidebar Lịch sử chat (aiChatSidebar)");
ok(html.includes('id="newChatBtn"'), "Có nút 'Đoạn chat mới' (newChatBtn)");
ok(html.includes("Đoạn chat mới"), "Hiển thị nhãn 'Đoạn chat mới'");
ok(html.includes('id="chatHistoryList"'), "Có vùng danh sách lịch sử (chatHistoryList)");
ok(html.includes('id="toggleChatSidebarBtn"'), "Có nút toggle ẩn/hiện sidebar (toggleChatSidebarBtn)");
ok(html.includes('class="ai-chat-main"'), "Có vùng Chat chính (ai-chat-main)");
ok(html.includes('id="aiChatBody"'), "Có khu vực cuộn hiển thị tin nhắn (aiChatBody)");
ok(html.includes('class="ai-chat-composer-container"'), "Có thanh nhập liệu ghim cố định ở đáy");
ok(html.includes('id="aiChatForm"'), "Có form nhập câu hỏi (aiChatForm)");
ok(html.includes('id="aiChatInput"'), "Có ô input nhập liệu (aiChatInput)");
ok(html.includes('id="aiChatSendBtn"'), "Có nút Gửi (aiChatSendBtn)");

// 2. Kiểm tra Typing Indicator (Bouncing Dots)
const pendingHtml = renderPendingBubble();
ok(pendingHtml.includes('class="typing-dot"'), "Typing indicator có các span.typing-dot");
ok(pendingHtml.includes('ai-typing'), "Typing indicator có class ai-typing");
ok(pendingHtml.includes('ai-msg-avatar'), "Typing indicator đi kèm avatar AI");

// 3. Quản lý lịch sử hội thoại (Store)
resetAiChat();
const initialConvId = aiChatState.conversationId;
ok(typeof initialConvId === "string", "Mỗi phiên có một conversationId khởi tạo");

// Thêm tin nhắn và đồng bộ
aiChatState.messages.push({ role: "user", text: "Giải thích Big O notation" });
aiChatState.messages.push({ role: "assistant", text: "Big O biểu diễn độ phức tạp thời gian." });
syncCurrentConversationToHistory();

ok(aiChatState.conversations.length === 1, "Hội thoại được lưu vào danh sách lịch sử");
ok(aiChatState.conversations[0].title.includes("Big O"), "Tiêu đề hội thoại lấy từ câu hỏi người dùng");

// Tạo đoạn chat mới
const newConvId = createNewConversation();
ok(newConvId !== initialConvId, "Tạo đoạn chat mới sinh conversationId mới");
ok(aiChatState.messages.length === 0, "Đoạn chat mới làm sạch mảng tin nhắn");
ok(aiChatState.conversations.length === 1, "Đoạn chat cũ vẫn được bảo lưu trong lịch sử");

// Render danh sách lịch sử
const historyHtml = renderHistoryList();
ok(historyHtml.includes("Big O notation"), "Danh sách lịch sử render đúng tiêu đề đoạn chat cũ");
ok(historyHtml.includes('data-conv-id='), "Mỗi item lịch sử có data-conv-id để chuyển đổi");
ok(historyHtml.includes('data-delete-conv-id='), "Mỗi item lịch sử có nút xóa data-delete-conv-id");

// Chuyển lại về đoạn chat cũ
const switched = selectConversation(initialConvId);
ok(switched === true, "Chuyển về đoạn chat cũ thành công");
ok(aiChatState.messages.length === 2, "Khôi phục đủ 2 tin nhắn của đoạn chat cũ");

// Xóa đoạn chat
deleteConversation(initialConvId);
ok(aiChatState.conversations.length === 0, "Xóa đoạn chat khỏi danh sách lịch sử thành công");

console.log(`\n==== RESULT: ${pass} PASS, ${fail} FAIL ====`);
if (fail) process.exit(1);

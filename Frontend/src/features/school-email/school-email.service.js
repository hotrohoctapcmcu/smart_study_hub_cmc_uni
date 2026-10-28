/**
 * UniStudy CMC - School Email Sync & Analysis Service (Sprint 2)
 * Đồng bộ và phân tích hòm thư sinh viên CMC (@student.cmcu.edu.vn)
 * Trích xuất deadline và lịch thi tự động để thêm vào state
 */
import { addLocalTask, addLocalExam } from "../../app/state.js";
import { workspaceRequest } from "../../shared/services/workspace-api.js";

export const schoolEmailStatus = { pending: false, error: "", text: "" };
const storeEmails = emails => getStorage().setItem(STORAGE_KEY, JSON.stringify(emails));

export async function fetchSchoolEmails() {
  const emails = await workspaceRequest("GET", "/email", { silent: true });
  hasCleanedLegacySeed = true; storeEmails(emails); return emails;
}

export async function syncSchoolEmails(connect = false) {
  if (schoolEmailStatus.pending) return;
  schoolEmailStatus.pending = true; schoolEmailStatus.error = "";
  try {
    if (connect) {
      if (!globalThis.window?.__uniStudyOutlook?.connect) throw new Error("Mở bằng npm start để đăng nhập Outlook; sau đó chọn Đồng bộ hòm thư.");
      await window.__uniStudyOutlook.connect();
    }
    const result = await workspaceRequest("POST", "/email/sync", { body: {}, timeout: 65000 });
    hasCleanedLegacySeed = true; storeEmails(result.messages);
    schoolEmailStatus.text = `Đã đồng bộ ${result.syncedCount} thư${result.account ? ' · ' + result.account : ''}.`;
    return result;
  } catch (error) { schoolEmailStatus.error = error.message; throw error; }
  finally { schoolEmailStatus.pending = false; }
}

export async function readSchoolEmailOnServer(id) {
  await workspaceRequest("PATCH", `/email/${encodeURIComponent(id)}/read`);
  markEmailRead(id);
  return getSchoolEmails().find(mail => mail.id === id);
}

export async function refreshSchoolEmail(id) {
  const saved = await workspaceRequest("POST", `/email/${encodeURIComponent(id)}/refresh`, { body: {}, timeout: 65000 });
  storeEmails(getSchoolEmails().map(mail => mail.id === id ? saved : mail)); return saved;
}

export async function markAllSchoolEmailsOnServer() {
  await workspaceRequest("PATCH", "/email/read"); markAllSchoolEmailsAsRead();
}

export async function processSchoolEmailOnServer(id, kind) {
  const result = await workspaceRequest("POST", `/email/${encodeURIComponent(id)}/${kind}`, { body: {} });
  await fetchSchoolEmails();
  if (kind === 'task') await (await import('../tasks/tasks.service.js')).fetchTasksFromApi();
  else await (await import('../exams/exams.service.js')).fetchExamsFromApi();
  return result;
}

const STORAGE_KEY = "unistudy_school_emails_v2";
const SEED_EMAIL_IDS = new Set(["mail-1", "mail-2", "mail-3"]);

const fallbackMemory = new Map();
function getStorage() {
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem: (k) => (fallbackMemory.has(k) ? fallbackMemory.get(k) : null),
    setItem: (k, v) => fallbackMemory.set(k, String(v)),
    removeItem: (k) => fallbackMemory.delete(k)
  };
}

// Dữ liệu mẫu dùng riêng cho kiểm thử tự động (không tự nạp vào ứng dụng chính)
export const MOCK_TEST_EMAILS = [
  {
    id: "mail-1",
    sender: "ThS. Trần Minh Tuấn <tuan.tm@cmcu.edu.vn>",
    senderName: "ThS. Trần Minh Tuấn (Giảng viên)",
    subject: "[PROG2001] Nhắc hạn nộp Bài tập lớn Lập trình Web",
    date: "2026-10-19T08:30:00.000Z",
    isRead: false,
    folder: "inbox",
    importance: "high",
    preview: "Chào các em lớp PROG2001, thầy nhắc các nhóm cần hoàn thành và nộp báo cáo dự án trước 23:59 ngày 25/10/2026...",
    body: `Chào các em sinh viên lớp Lập trình Web (PROG2001),

Thầy nhắc lại về tiến độ bài tập lớn học phần:
- Hạn chót nộp báo cáo và mã nguồn trên hệ thống là: 23:59 ngày 25/10/2026.
- Mọi trường hợp nộp muộn sẽ bị trừ 10% điểm mỗi ngày.
- Yêu cầu mã nguồn viết bằng JavaScript thuần ES Modules, không sử dụng framework ngoài quy định.

Chúc các em hoàn thành tốt đồ án!
ThS. Trần Minh Tuấn`,
    extractedDeadline: {
      title: "Nộp báo cáo Bài tập lớn Lập trình Web",
      subject: "Lập trình Web",
      due: "2026-10-25T23:59",
      priority: "Cao"
    }
  },
  {
    id: "mail-2",
    sender: "Phòng Khảo thí <khaothi@cmcu.edu.vn>",
    senderName: "Phòng Khảo thí & Đảm bảo CL",
    subject: "Thông báo Lịch thi kết thúc học phần Cơ sở dữ liệu (DBI202)",
    date: "2026-10-17T14:15:00.000Z",
    isRead: true,
    folder: "inbox",
    importance: "normal",
    preview: "Phòng Khảo thí xin thông báo lịch thi chính thức môn Cơ sở dữ liệu: Ngày 16/11/2026, ca thi 08:00, Phòng A205...",
    body: `Kính gửi sinh viên CMC University,

Phòng Khảo thí thông báo lịch thi kết thúc học phần học kỳ 1 năm học 2026 - 2027:
- Học phần: Cơ sở dữ liệu (DBI202)
- Ngày thi: 16/11/2026
- Giờ thi: 08:00 (Thời lượng: 90 phút)
- Phòng thi: A205 (Tòa nhà Alpha)
- Hình thức: Thi trắc nghiệm kết hợp thực hành trên máy.

Sinh viên mang theo thẻ sinh viên và có mặt trước giờ thi 15 phút.
Trân trọng,
Phòng Khảo thí & ĐBCL`,
    extractedExam: {
      subject: "Cơ sở dữ liệu",
      code: "DBI202",
      date: "2026-11-16",
      start: "08:00",
      duration: 90,
      room: "A205",
      scope: "Thi trắc nghiệm và thực hành SQL"
    }
  },
  {
    id: "mail-3",
    sender: "Phòng Quản lý Đào tạo <daotao@cmcu.edu.vn>",
    senderName: "Phòng Quản lý Đào tạo CMC",
    subject: "Thông báo Hạn nộp Học phí và Đăng ký môn học bổ sung",
    date: "2026-10-14T09:00:00.000Z",
    isRead: true,
    folder: "inbox",
    importance: "normal",
    preview: "Nhà trường thông báo thời hạn cuối nộp học phí học kỳ hiện tại là ngày 30/10/2026. Sinh viên kiểm tra thông tin...",
    body: `Kính gửi các bạn sinh viên,

Phòng Đào tạo thông báo hạn cuối hoàn thành nghĩa vụ học phí học kỳ là trước ngày 30/10/2026.
Sinh viên chưa hoàn thành sẽ không có tên trong danh sách thi chính thức.
Vui lòng đối soát trên cổng IU hoặc liên hệ phòng Tài vụ.

Phòng QL Đào tạo CMC University`,
    extractedDeadline: {
      title: "Hạn cuối nộp học phí học kỳ CMC",
      subject: "Phòng Đào tạo",
      due: "2026-10-30T17:00",
      priority: "Trung bình"
    }
  }
];

let hasCleanedLegacySeed = false;

/**
 * Lấy danh sách email thực tế của sinh viên.
 * Không tự tạo email giả khi chưa có dữ liệu thật.
 */
export function getSchoolEmails() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return [];
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    if (!hasCleanedLegacySeed) {
      hasCleanedLegacySeed = true;
      parsed = parsed.filter((m) => !SEED_EMAIL_IDS.has(m.id));
      getStorage().setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return [];
  }
}

export function markEmailRead(emailId) {
  const emails = getSchoolEmails().map((m) => {
    if (m.id === emailId) return { ...m, isRead: true };
    return m;
  });
  getStorage().setItem(STORAGE_KEY, JSON.stringify(emails));
  return emails;
}

export function markAllSchoolEmailsAsRead() {
  const emails = getSchoolEmails().map((m) => ({ ...m, isRead: true }));
  getStorage().setItem(STORAGE_KEY, JSON.stringify(emails));
  return emails;
}

/**
 * Trích xuất deadline từ email và tự động tạo task vào state.tasks
 */
export function createTaskFromEmail(emailId) {
  const email = getSchoolEmails().find((m) => m.id === emailId);
  if (!email || !email.extractedDeadline || email.isProcessed) return null;

  const newTask = addLocalTask({
    title: email.extractedDeadline.title,
    subject: email.extractedDeadline.subject,
    due: email.extractedDeadline.due,
    priority: email.extractedDeadline.priority || "Cao",
    status: "Chưa làm",
    checklist: [
      { id: `chk-${Date.now()}-1`, text: "Đọc kỹ yêu cầu trong email trường", done: true },
      { id: `chk-${Date.now()}-2`, text: "Hoàn thiện nội dung cần nộp", done: false }
    ]
  });

  // Đánh dấu email đã xử lý
  const updatedEmails = getSchoolEmails().map((m) => {
    if (m.id === emailId) {
      return { ...m, isProcessed: true, isRead: true };
    }
    return m;
  });
  getStorage().setItem(STORAGE_KEY, JSON.stringify(updatedEmails));

  return newTask;
}

/**
 * Trích xuất lịch thi từ email và tạo vào state.exams
 */
export function createExamFromEmail(emailId) {
  const email = getSchoolEmails().find((m) => m.id === emailId);
  if (!email || !email.extractedExam || email.isExamProcessed) return null;

  const newExam = addLocalExam({
    subject: email.extractedExam.subject,
    code: email.extractedExam.code,
    date: email.extractedExam.date,
    start: email.extractedExam.start,
    duration: email.extractedExam.duration,
    room: email.extractedExam.room,
    scope: email.extractedExam.scope,
    source: "Tự thêm"
  });

  const updatedEmails = getSchoolEmails().map((m) => {
    if (m.id === emailId) {
      return { ...m, isExamProcessed: true, isRead: true };
    }
    return m;
  });
  getStorage().setItem(STORAGE_KEY, JSON.stringify(updatedEmails));

  return newExam;
}

/**
 * Trợ giúp nạp email kiểm thử (Chỉ dùng trong test runner)
 */
export function seedTestEmailsForTesting(emails = MOCK_TEST_EMAILS) {
  hasCleanedLegacySeed = true;
  if (Array.isArray(emails)) {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(emails));
  }
}

/**
 * UniStudy CMC - Sync Service
 * Interface dịch vụ đồng bộ theo API_FUNCTION_MAP.md & API_CONTRACT.md.
 * Khi chưa có backend: trả trạng thái unavailable theo hợp đồng chung.
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { formatDateISO } from "../../shared/utils/date.js";
import { SYNC_SOURCES } from "../../shared/config/sync-sources.js";
import { state, notifyStateChange } from "../../app/state.js";
import {
  syncState,
  setSourceStatus,
  setSourceMessage,
  markSourceSynced
} from "../../app/sync-state.js";

// Khoảng thời gian mặc định để kéo TKB + lịch thi từ cổng IU khi người dùng
// không chỉ định (bao quát học kỳ hiện tại: từ đầu học kỳ đến cuối năm).
const NGAY_BAT_DAU_MAC_DINH = "01/09/2026";
const NGAY_KET_THUC_MAC_DINH = "31/08/2027";

/**
 * Lấy danh sách nguồn đồng bộ
 */
export async function getSyncSources() {
  const res = await apiRequest(ENDPOINTS.sync.getSources);
  if (res.unavailable) {
    // Trả danh sách nguồn từ config client cục bộ
    return {
      success: true,
      sources: SYNC_SOURCES,
      isLiveApi: false
    };
  }
  return res;
}

/**
 * Bắt đầu job đồng bộ lên server (sau khi có backend)
 */
export async function startSync(selectedSourceIds) {
  return await apiRequest(ENDPOINTS.sync.startSync, {
    body: { sources: selectedSourceIds }
  });
}

/**
 * Lấy trạng thái tiến trình đồng bộ
 */
export async function getSyncStatus(jobId) {
  return await apiRequest(ENDPOINTS.sync.getStatus, {
    params: { jobId }
  });
}

// ─── Nhánh IU tự động (Electron bridge -> API -> IU -> DB) ───────────────

/**
 * Cầu nối Electron do preload expose (window.__uniStudyIU).
 * null khi mở web thuần (không có IPC) — caller tự fallback.
 */
export function getIuBridge() {
  try {
    const b = window.__uniStudyIU;
    if (b && b.isAvailable === true && typeof b.loginIU === "function") return b;
  } catch { /* ignore */ }
  return null;
}

/**
 * Trạng thái phiên IU trên server (không lộ cookie).
 * @returns {Promise<{connected: boolean}>}
 */
export async function fetchIuStatus() {
  const bridge = getIuBridge();
  if (bridge) {
    try {
      return await bridge.iuStatus();
    } catch { /* rớt xuống gọi API trực tiếp */ }
  }
  const res = await apiRequest(ENDPOINTS.sync.iuStatus);
  if (!res.success) return { ok: false, connected: false };
  const data = res.data || {};
  return { ok: true, connected: Boolean(data.connected ?? data.success), status: data };
}

/**
 * Đăng nhập IU qua cầu nối Electron (mở cửa sổ SSO riêng, lưu phiên lên API).
 * Ném lỗi để caller hiển thị.
 */
export async function loginIuViaBridge(opts = {}) {
  const bridge = getIuBridge();
  if (!bridge) {
    throw new Error("Tính năng tự động chỉ chạy trong app Electron. Hãy mở app bằng `npm start`.");
  }
  return await bridge.loginIU({ timeoutMs: opts.timeoutMs || 180000 });
}

/**
 * Kéo dữ liệu IU bằng phiên đã lưu (server gọi IU + lưu DB).
 * @param {object} [opts] - { ngayBatDau, ngayKetThuc }
 * @returns {Promise<{timetableCount, examsCount, gradesCount, thatBai}>}
 */
export async function pullIuData(opts = {}) {
  const ngayBatDau = opts.ngayBatDau || NGAY_BAT_DAU_MAC_DINH;
  const ngayKetThuc = opts.ngayKetThuc || NGAY_KET_THUC_MAC_DINH;
  const bridge = getIuBridge();
  if (bridge) {
    return await bridge.pullIU({
      ngayBatDau,
      ngayKetThuc,
      luuDb: opts.luuDb !== false
    });
  }
    const res = await apiRequest(ENDPOINTS.sync.iuPull, {
    body: { ngayBatDau, ngayKetThuc, luuDb: opts.luuDb !== false }
  });
  if (!res.success) {
    throw new Error((res.data && res.data.message) || res.error || "Kéo dữ liệu IU thất bại.");
  }
  const saved = (res.data && res.data.savedDb) || {};
  return {
    ok: true,
    message: (res.data && res.data.message) || "",
    timetableCount: saved.timetableCount || 0,
    examsCount: saved.examsCount || 0,
    gradesCount: saved.gradesCount || 0,
    thatBai: res.data.thatBai || []
  };
}

/**
 * Xoá phiên IU (server + partition trình duyệt Electron).
 */
export async function logoutIu() {
  const bridge = getIuBridge();
  if (bridge) {
    try { await bridge.logoutIU(); } catch { /* ignore */ }
  } else {
    await apiRequest({ method: "DELETE", path: "/api/v1/sync/iu/session" });
  }
  setSourceStatus("iu", "unconnected");
}

/**
 * Chuẩn hoá 1 dòng TKB server -> event hiển thị trong Lịch học / Dashboard.
 * Server trả { subject_code, subject_name, class_name, room, day_of_week,
 * start_time, end_time, start_date, end_date, lecturer_name } (mock) hoặc
 * record procedure (live). FE cần { id, title, subject, date, start, end,
 * room, lecturer, source }.
 */
export function mapTimetableRow(t, idx) {
  const startDate = String(t.start_date || t.startDate || "").slice(0, 10);
  const endDate = String(t.end_date || t.endDate || startDate).slice(0, 10);
  return {
    id: `school-${t.timetable_id ?? t.id ?? idx}`,
    title: t.subject_name || t.subjectName || "Tiết học",
    subject: t.subject_name || t.subjectName || "",
    className: t.class_name || t.className || "",
    date: startDate,
    endDate,
    start: String(t.start_time || t.startTime || "07:30").slice(0, 5),
    end: String(t.end_time || t.endTime || "09:30").slice(0, 5),
    room: t.room || "",
    lecturer: t.lecturer_name || t.lecturerName || "",
    dayOfWeek: t.day_of_week ?? t.dayOfWeek ?? null,
    source: "Trường",
    isLocalDraft: false
  };
}

/**
 * Chuẩn hoá 1 dòng lịch thi server -> exam trong state.
 * FE cần { id, subject, date, start, duration, room, source }.
 */
function mapExamRow(e, idx) {
  const rawDate = e.exam_date || e.examDate || e.date || "";
  const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate).slice(0, 10);
  const time = String(e.exam_time || e.examTime || e.start || "08:00").slice(0, 5);
  return {
    id: `exam-school-${e.exam_id ?? e.id ?? idx}`,
    subject: e.subject_name || e.subjectName || e.subject || "",
    code: e.subject_code || e.subjectCode || "",
    date,
    start: time,
    duration: Number(e.duration_minutes ?? e.durationMinutes ?? e.duration) || 90,
    room: e.room || e.phong_thi || "Chưa xếp phòng",
    scope: e.exam_format || e.examFormat || "",
    source: "Trường",
    isLocalDraft: false,
    studyMilestones: []
  };
}

/**
 * Lấy lịch học trường từ API backend (dữ liệu thật từ SQLite, KHÔNG dùng mock).
 * Trả về mảng event chuẩn { id, title, subject, date, start, end, room, lecturer, source }.
 * @returns {Promise<Array<object>>}
 */
export async function fetchSchoolSchedules() {
  const res = await apiRequest(ENDPOINTS.schedules.list);
  if (!res.success) {
    const rows = [];
    if (res.unavailable) return rows;
    throw new Error(res.error || "Không lấy được lịch học từ server.");
  }
  const rows = res.data?.data ?? res.data ?? [];
  if (!Array.isArray(rows)) return [];

  // Gộp mỗi tiết học vào từng ngày trong khoảng start_date → end_date
  const events = [];
  let idx = 0;
  for (const row of rows) {
    const startDate = String(row.start_date || "").slice(0, 10);
    const endDate = String(row.end_date || startDate).slice(0, 10);
    const dayOfWeek = Number(row.day_of_week); // 2=T2 ... 8=CN
    if (!startDate || !dayOfWeek) continue;

    // Lặp qua các ngày trong khoảng mà thứ khớp với day_of_week
    let cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) {
      const jsDay = cur.getDay(); // 0=CN ... 6=T7
      const projDay = jsDay === 0 ? 8 : jsDay + 1; // 2=T2 ... 8=CN
      if (projDay === dayOfWeek) {
        events.push({
          id: `school-${row.timetable_id ?? idx}-${formatDateISO(cur)}`,
          title: row.subject_name || row.subject || "Tiết học",
          subject: row.subject_name || row.subject || "",
          className: row.class_name || row.className || "",
          date: formatDateISO(cur),
          start: String(row.start_time || "07:30").slice(0, 5),
          end: String(row.end_time || "09:30").slice(0, 5),
          room: row.room || "",
          lecturer: row.lecturer_name || row.lecturerName || "",
          source: row.source || "Trường",
          isLocalDraft: false,
        });
      }
      cur.setDate(cur.getDate() + 1);
      idx += 1;
    }
  }
  return events;
}

/**
 * Nạp hồ sơ + TKB + lịch thi đã lưu trên server vào state hiển thị.
 * Gọi sau pullIuData() thành công. Không ném lỗi (từng phần độc lập).
 * @returns {Promise<{profile: boolean, schedules: number, exams: number}>}
 */
export async function refreshFromServer() {
  const out = { profile: false, schedules: 0, exams: 0 };

  const prof = await apiRequest(ENDPOINTS.student.getProfile);
  if (prof.success && prof.data) {
    const p = prof.data.data ?? prof.data;
    if (p && (p.full_name || p.fullName || p.student_code || p.studentCode)) {
      state.studentProfile = {
        name: p.full_name || p.fullName || "Chưa có dữ liệu",
        studentId: p.student_code || p.studentCode || "Chưa có dữ liệu",
        email: p.email || "Chưa có dữ liệu"
      };
      out.profile = true;
    }
  }

  const sched = await apiRequest(ENDPOINTS.schedules.list);
  const schedRows = sched.success ? (sched.data?.data ?? sched.data) : null;
  if (Array.isArray(schedRows)) {
    state.schoolEvents = schedRows.map(mapTimetableRow);
    out.schedules = state.schoolEvents.length;
  }

  const ex = await apiRequest(ENDPOINTS.exams.list);
  const examRows = ex.success ? (ex.data?.data ?? ex.data) : null;
  if (Array.isArray(examRows)) {
    const schoolExams = examRows.map(mapExamRow);
    state.exams = [...schoolExams, ...state.exams.filter((e) => e.source !== "Trường")];
    out.exams = schoolExams.length;
  }

  notifyStateChange();
  return out;
}

/**
 * Luồng tự động trọn vòng trong Electron:
 * login (cửa sổ SSO riêng) -> pull (server kéo IU + lưu DB)
 * -> nạp vào state hiển thị. Ném lỗi để caller hiển thị message.
 */
export async function syncIuAuto(opts = {}) {
  syncState.isSyncing = true;
  setSourceStatus("iu", "syncing");
  setSourceMessage("iu", "Đang mở cửa sổ đăng nhập IU...");
  notifyStateChange();
  try {
    await loginIuViaBridge(opts);
    setSourceStatus("iu", "portal_opened");
    setSourceMessage("iu", "Đã đăng nhập IU. Đang kéo thời khóa biểu, lịch thi, bảng điểm...");
    notifyStateChange();

    const pulled = await pullIuData(opts);
    const loaded = await refreshFromServer();
    markSourceSynced("iu");
    const soTkb = loaded.schedules || pulled.timetableCount || 0;
    const soThi = loaded.exams || pulled.examsCount || 0;
    let message =
      `Đồng bộ IU xong: ${soTkb} tiết TKB, ${soThi} kỳ thi` +
      (pulled.gradesCount ? `, ${pulled.gradesCount} đầu điểm` : "") + ".";
    // Hiển thị nguyên nhân khi IU không trả dữ liệu (trước đây lỗi bị nuốt).
    if ((!soTkb || !soThi) && Array.isArray(pulled.thatBai) && pulled.thatBai.length) {
      message += ` Lỗi từ cổng IU: ${pulled.thatBai.join("; ")}`;
    }
    setSourceMessage("iu", message);
    notifyStateChange();
    return { pulled, loaded };
  } catch (err) {
    setSourceStatus("iu", "error");
    setSourceMessage("iu", `Đồng bộ IU thất bại: ${err.message}`);
    notifyStateChange();
    throw err;
  } finally {
    syncState.isSyncing = false;
    notifyStateChange();
  }
}


// ─── Nhánh EDUX (đăng nhập bằng tài khoản EDUX -> API -> bài tập) ────────

/**
 * Chuẩn hoá 1 bài tập EDUX (API trả về) thành task trong state.
 * EDUX không công bố hạn nộp nên `due` giữ null — không bịa deadline.
 */
export function mapEduxAssignment(item, idx = 0) {
  const id = String(item?.id || `edux-${idx}`);
  return {
    id,
    title: item?.title || "Bài tập EDUX",
    subject: item?.subject || "Học phần EDUX",
    due: item?.due || null,
    priority: item?.priority || "Trung bình",
    status: item?.status || "Chưa làm",
    checklist: [],
    note: item?.description || "",
    description: item?.description || "",
    completedAt: null,
    source: "EDUX",
    externalId: id,
    subjectId: item?.subjectId || null,
    modelId: item?.modelId || null,
    chapter: item?.chapter || null,
    highestScore: item?.highestScore ?? null,
    progress: item?.progress || null,
    isLocalDraft: false
  };
}

/**
 * Gộp bài tập EDUX vào state.tasks, giữ nguyên task người dùng tự nhập.
 * Bài EDUX cũ bị thay thế toàn bộ để phản ánh đúng dữ liệu mới nhất.
 * @returns {number} số bài EDUX sau khi gộp
 */
export function mergeEduxTasks(assignments) {
  const eduxTasks = (Array.isArray(assignments) ? assignments : []).map(mapEduxAssignment);
  const localTasks = (state.tasks || []).filter((t) => t.source !== "EDUX");
  state.tasks = [...eduxTasks, ...localTasks];
  return eduxTasks.length;
}

/**
 * Trạng thái phiên EDUX trên server (không lộ cookie).
 * @returns {Promise<{ok: boolean, connected: boolean, email?: string|null}>}
 */
export async function fetchEduxStatus() {
  const res = await apiRequest(ENDPOINTS.sync.eduxStatus);
  if (!res.success) return { ok: false, connected: false, email: null };
  const data = res.data || {};
  return {
    ok: true,
    connected: Boolean(data.connected),
    email: data.email || null,
    expiresAt: data.expiresAt || null
  };
}

/**
 * Đăng nhập EDUX bằng email + mật khẩu người dùng nhập.
 * Mật khẩu chỉ gửi một lần tới API, KHÔNG lưu vào state/localStorage.
 * @throws {Error} khi thông tin đăng nhập sai hoặc EDUX không phản hồi
 */
export async function loginEdux(email, password) {
  const res = await apiRequest(ENDPOINTS.sync.eduxSaveSession, {
    body: { email, password }
  });
  if (res.unavailable) {
    throw new Error("Hệ thống backend chưa được kết nối nên không đăng nhập được EDUX.");
  }
  if (!res.success) {
    throw new Error((res.data && res.data.message) || res.error || "Đăng nhập EduX thất bại.");
  }
  const data = res.data || {};
  syncState.eduxEmail = data.email || email;
  setSourceStatus("edux", "portal_opened");
  setSourceMessage("edux", `Đã đăng nhập EduX${data.email ? ` (${data.email})` : ""}.`);
  return data;
}

/**
 * Kéo bài tập AI từ EDUX bằng phiên đã lưu trên server.
 * @param {{subjectId?: string, questions?: boolean}} [opts]
 * @returns {Promise<{assignments: Array<object>, thatBai: string[]}>}
 */
export async function pullEduxData(opts = {}) {
  const res = await apiRequest(ENDPOINTS.sync.eduxPull, {
    body: {
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      questions: opts.questions === true
    }
  });
  if (res.unavailable) {
    throw new Error("Hệ thống backend chưa được kết nối nên không kéo được dữ liệu EDUX.");
  }
  if (!res.success) {
    if (res.status === 401) {
      setSourceStatus("edux", "unconnected");
      syncState.eduxEmail = null;
    }
    throw new Error((res.data && res.data.message) || res.error || "Kéo dữ liệu EduX thất bại.");
  }
  // /sync/edux/pull trả phẳng; /tasks/edux bọc trong `data` — chấp nhận cả hai.
  const data = (res.data && res.data.data) || res.data || {};
  return {
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
    thatBai: Array.isArray(data.thatBai) ? data.thatBai : [],
    message: data.message || ""
  };
}

/**
 * Xoá phiên EDUX trên server và dữ liệu bài tập EDUX trong state.
 */
export async function logoutEdux() {
  await apiRequest(ENDPOINTS.sync.eduxDeleteSession);
  state.tasks = (state.tasks || []).filter((t) => t.source !== "EDUX");
  syncState.eduxEmail = null;
  setSourceStatus("edux", "unconnected");
  setSourceMessage("edux", "");
  notifyStateChange();
}

/**
 * Luồng EDUX trọn vòng: đăng nhập -> kéo bài tập -> gộp vào state hiển thị.
 * Ném lỗi để caller hiển thị message; không đụng tới trạng thái IU.
 *
 * @param {{email: string, password: string, subjectId?: string, questions?: boolean}} opts
 */
export async function syncEduxAuto(opts = {}) {
  setSourceStatus("edux", "syncing");
  setSourceMessage("edux", "Đang đăng nhập EDUX...");
  notifyStateChange();

  try {
    await loginEdux(opts.email, opts.password);

    setSourceMessage("edux", "Đã đăng nhập EduX. Đang kéo bài tập theo học phần...");
    notifyStateChange();

    const pulled = await pullEduxData(opts);
    const soBai = mergeEduxTasks(pulled.assignments);

    markSourceSynced("edux");
    let message = `Đồng bộ EduX xong: ${soBai} bài tập AI.`;
    if (!soBai) {
      message += " Tài khoản chưa có chương nào kèm bài tập AI.";
    }
    if (pulled.thatBai.length) {
      message += ` Một số chương lỗi: ${pulled.thatBai.join("; ")}`;
    }
    setSourceMessage("edux", message);
    syncState.lastSyncTimestamp = syncState.lastSyncTimestamps.edux || new Date().toISOString();
    notifyStateChange();

    return { pulled, count: soBai };
  } catch (err) {
    setSourceStatus("edux", "error");
    setSourceMessage("edux", `Đồng bộ EduX thất bại: ${err.message}`);
    notifyStateChange();
    throw err;
  }
}

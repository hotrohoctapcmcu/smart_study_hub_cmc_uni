"use strict";

/**
 * data/index.js — Cum DU LIEU EDUX: goi API EDUX truc tiep + tra du lieu tho.
 *
 * File tong hop cua folder data/; ben ngoai chi dung qua ../index.js.
 * Moi ham nhan (id, opts) voi opts = { cookie, concurrency, reLogin }.
 *   - cookie: chuoi Cookie phien (API giu trong RAM, khong doc cookie.txt).
 *   - Cac ham chinh (layHocPhan / layChuongTrinhHoc / layBaiTap) de loi 401
 *     noi bot de caller xoa phien; cac ham phu tra [] khi endpoint khong co.
 */

const { goiEdux, thuLanLuot } = require("../request");
const { asList, unwrap, firstValue, cleanText, isoTime, parallel } = require("../utils");

function cookieCua(opts = {}) {
  return opts.cookie || opts.Cookie || "";
}

function tuyChon(coBan = {}, goiLai) {
  const out = { ...coBan };
  if (goiLai) out.reLogin = goiLai;
  return out;
}

function docDanhSach(raw, keys, opts) {
  if (opts.strict) {
    const root = unwrap(raw);
    const queue = [root];
    let found = Array.isArray(root);
    while (queue.length && !found) {
      const item = queue.shift();
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      found = keys.some(key => Array.isArray(item[key]));
      for (const value of Object.values(item)) {
        if (value && typeof value === "object" && !Array.isArray(value)) queue.push(value);
      }
    }
    if (!found) throw Object.assign(new Error("Phản hồi EDUX thiếu danh sách học liệu."), { status: 502 });
  }
  return asList(raw, keys);
}

// --- Hoc phan / chuong trinh hoc (BAT BUOC cho /tasks/edux) ---

async function layHocPhan(opts = {}) {
  const raw = await goiEdux("/subjects/joined", {
    cookie: cookieCua(opts),
    reLogin: opts.reLogin,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  return docDanhSach(raw, ["subjects", "items", "list", "data"], opts);
}

async function layChuongTrinhHoc(subjectId, opts = {}) {
  if (!subjectId) return [];
  const raw = await goiEdux(`/subjects/${encodeURIComponent(subjectId)}/models`, {
    cookie: cookieCua(opts),
    reLogin: opts.reLogin,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  return docDanhSach(raw, ["models", "items", "list", "data"], opts);
}

function docPhanHoiHan(raw) {
  if (raw?.code != null && String(raw.code) !== "200") {
    const status = Number(raw.code);
    throw Object.assign(new Error("Không lấy được thời hạn EDUX."), {
      status: Number.isInteger(status) && status >= 400 && status < 600 ? status : 502,
    });
  }
  return unwrap(raw);
}

/** The subject endpoint takes the current subject's model ids and joined class ids. */
async function layHanHocPhan(subjectId, modelIds, opts = {}) {
  const ids = [...new Set((modelIds || []).filter(Boolean).map(String))];
  if (!subjectId || !ids.length) return { start_time_subject: null, max_deadline: null };
  const chung = { cookie: cookieCua(opts), reLogin: opts.reLogin, timeoutMs: opts.timeoutMs, signal: opts.signal };
  const rawGroups = await goiEdux("/groups", { ...chung, params: { subject_id: subjectId } });
  docPhanHoiHan(rawGroups);
  const groups = docDanhSach(rawGroups, ["groups", "items", "list", "data"], { strict: true });
  const groupIds = [...new Set(groups.map(group => group?.id).filter(Boolean).map(String))];
  if (!groupIds.length) return { start_time_subject: null, max_deadline: null };
  const raw = await goiEdux("/groups/get_subject_deadlines", {
    ...chung, method: "POST", body: { model_ids: ids, group_ids: groupIds },
  });
  const result = docPhanHoiHan(raw);
  if (!result || typeof result !== "object" || !Object.hasOwn(result, "max_deadline")) {
    throw Object.assign(new Error("Phản hồi EDUX thiếu thời hạn học phần."), { status: 502 });
  }
  return { start_time_subject: result.start_time_subject ?? null, max_deadline: result.max_deadline };
}

/** Read the student's effective AI exam deadline without creating an exam attempt. */
async function layHanBaiTap(modelId, opts = {}) {
  if (!modelId) return { exam_deadline: null };
  const raw = await goiEdux(`/exam/deadline/check/${encodeURIComponent(modelId)}`, {
    cookie: cookieCua(opts), reLogin: opts.reLogin, timeoutMs: opts.timeoutMs, signal: opts.signal,
  });
  const result = docPhanHoiHan(raw);
  if (!result || typeof result !== "object" || (!Object.hasOwn(result, "exam_deadline") && result.status !== "no_deadline")) {
    throw Object.assign(new Error("Phản hồi EDUX thiếu thời hạn bài kiểm tra."), { status: 502 });
  }
  return { ...result, exam_deadline: result.exam_deadline ?? null };
}

// --- Bai tap AI ---

function mapExamData(examData) {
  const root = unwrap(examData);
  const danhSach =
    (root && Array.isArray(root.multiple_choice) && root.multiple_choice) ||
    (root && Array.isArray(root.questions) && root.questions) ||
    (Array.isArray(root) ? root : []);
  return danhSach.map((cau, index) => {
    if (cau !== null && typeof cau === "object") {
      return {
        id: firstValue(cau, ["id", "question_id", "qid"]) ?? `cau_${index + 1}`,
        cau_hoi: firstValue(cau, ["question", "content", "title", "cau_hoi"]) ?? "",
        dap_an: firstValue(cau, ["options", "choices", "answers", "dap_an"]) ?? null,
        dap_an_dung: firstValue(cau, ["correct_answer", "answer", "dap_an_dung"]) ?? null,
        diem: firstValue(cau, ["score", "point", "diem"]) ?? null,
        tho: cau,
      };
    }
    return { id: `cau_${index + 1}`, cau_hoi: String(cau ?? ""), dap_an: null, tho: cau };
  });
}

async function layBaiTap(modelId, opts = {}) {
  if (!modelId) return { cau_hoi: [], session_id: null, tho: null };
  const raw = await goiEdux("/exam/start", {
    method: "POST",
    body: { model_id: modelId, modelId, id: modelId },
    cookie: cookieCua(opts),
    reLogin: opts.reLogin,
  });
  const root = unwrap(raw) || {};
  const examData = root.exam_data ?? root.data?.exam_data ?? root;
  return {
    cau_hoi: mapExamData(examData),
    session_id: root.session_id ?? root.sessionId ?? null,
    tho: raw,
  };
}

// --- Slide bai giang ---

async function laySlide(modelId, opts = {}) {
  if (!modelId) return [];
  const id = encodeURIComponent(modelId);
  // EDUX's current lecture player reads this endpoint. /models/:id/slides
  // belongs to an older API and returns 404 on the production portal.
  const routes = [
    `/api/v1/presentation/document-summary?model_id=${id}&edit=false`,
    `/subjects/models/${id}/slides`, `/models/${id}/slides`,
    `/subjects/models/${id}/documents`, `/models/${id}/documents`,
  ];
  if (opts.strict) {
    const raw = await docTheoRoute(routes, opts);
    return docDanhSach(raw, ["slides", "documents", "items", "list", "data"], opts);
  }
  const thu = await thuLanLuot(
    routes,
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return [];
  return asList(thu.data, ["slides", "documents", "items", "list", "data"]);
}

// Material sync must distinguish an empty chapter from an endpoint failure.
// Only a missing route permits trying another route; expired sessions and
// transient failures are left to the caller, never converted into an empty list.
async function docTheoRoute(routes, opts = {}) {
  let lastError;
  for (const route of routes) {
    try {
      return await goiEdux(route, {
        cookie: cookieCua(opts), reLogin: opts.reLogin,
        retry: false, timeoutMs: opts.timeoutMs, signal: opts.signal,
      });
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(Number(error.status))) throw error;
    }
  }
  throw lastError || new Error("Không tìm thấy nguồn slide EDUX.");
}

async function layNoiDungSlide(documentId, opts = {}) {
  if (documentId === undefined || documentId === null || documentId === "") {
    throw Object.assign(new Error("Slide thiếu mã tài liệu."), { status: 400 });
  }
  const id = encodeURIComponent(documentId);
  // Default API_BASE is /api; EDUX's presentation endpoint uses /api/api/v1.
  const raw = await docTheoRoute([
    `/api/v1/presentation/document/${id}`,
    `/presentation/document/${id}`,
  ], opts);
  // Lecture sync needs the original image as well as the extracted text.
  // Keep the old text-only contract for other crawler consumers.
  if (opts.includeImages) {
    const document = raw?.data ?? raw;
    return typeof document === "object" && document !== null
      ? { ...document, content: document.content }
      : { content: document };
  }
  return raw?.data?.content ?? raw?.content;
}

// --- Lop hoc phan / nhom / diem ---

async function layLopHocPhan(opts = {}) {
  const thu = await thuLanLuot(
    ["/groups", "/subjects/groups", "/classes", "/lop-hoc-phan"],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return [];
  return asList(thu.data, ["groups", "items", "list", "data"]);
}

async function layChiTietLopHocPhan(groupId, opts = {}) {
  if (!groupId) return {};
  const thu = await thuLanLuot(
    [`/groups/${groupId}`, `/subjects/groups/${groupId}`],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return { id: groupId };
  return unwrap(thu.data) || {};
}

async function layNhom(groupId, opts = {}) {
  return layDiemNhom(groupId, opts);
}

function mapDiemNhom(tho) {
  const danhSach = Array.isArray(tho) ? tho : asList(tho, ["teams", "groups", "nhom", "items", "data"]);
  return danhSach.map((team, index) => ({
    team_id: firstValue(team, ["id", "team_id"]) ?? `nhom_${index + 1}`,
    ten_nhom: firstValue(team, ["name", "ten_nhom", "ten"]) ?? null,
    chu_de: firstValue(team, ["topic", "chu_de", "subject"]) ?? null,
    link: firstValue(team, ["link", "url"]) ?? null,
    thanh_vien: Array.isArray(team?.members ?? team?.thanh_vien)
      ? (team.members ?? team.thanh_vien).map((tv) => ({
          user_id: firstValue(tv, ["user_id", "id", "userId"]) ?? null,
          ten: firstValue(tv, ["name", "ten"]) ?? null,
          email: firstValue(tv, ["email"]) ?? null,
          la_nhom_truong: Boolean(firstValue(tv, ["is_leader", "la_nhom_truong"]) ?? false),
          diem: Array.isArray(tv?.scores ?? tv?.diem) ? (tv.scores ?? tv.diem) : [],
        }))
      : [],
    dau_diem: Array.isArray(team?.scores ?? team?.dau_diem) ? (team.scores ?? team.dau_diem) : [],
    tho: team,
  }));
}

async function layDiemNhom(groupId, opts = {}) {
  if (!groupId) return [];
  const thu = await thuLanLuot(
    [`/groups/${groupId}/scores`, `/groups/${groupId}/teams`, `/groups/${groupId}/members`],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return [];
  return mapDiemNhom(thu.data);
}

async function layDiemHocPhan(subjectId, opts = {}) {
  if (!subjectId) return [];
  const thu = await thuLanLuot(
    [`/subjects/${subjectId}/scores`, `/subjects/${subjectId}/grades`],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return [];
  return asList(thu.data, ["scores", "grades", "items", "data"]);
}

async function layBangDiem(opts = {}) {
  const thu = await thuLanLuot(
    ["/scores", "/grades", "/subjects/scores", "/me/scores"],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  if (!thu.data) return [];
  return asList(thu.data, ["scores", "grades", "items", "data"]);
}

// --- Thong bao / phan hoi ---

async function layNhomThongTin(routes, opts = {}) {
  const thu = await thuLanLuot(routes, {
    cookie: cookieCua(opts),
    reLogin: opts.reLogin,
    retry: false,
  });
  if (!thu.data) return [];
  const items = asList(thu.data, ["items", "notifications", "feedbacks", "reports", "list", "data"]);
  return items.map((item) => {
    if (!item || typeof item !== "object") return { tho: item };
    return {
      hoc_phan: firstValue(item, ["subject", "hoc_phan", "subject_name"]) ?? "",
      tieu_de: firstValue(item, ["title", "tieu_de"]) ?? "",
      cau_hoi: firstValue(item, ["question", "cau_hoi"]) ?? "",
      noi_dung: cleanText(firstValue(item, ["content", "noi_dung", "message", "body"]) ?? ""),
      phan_hoi: cleanText(firstValue(item, ["reply", "phan_hoi", "response", "answer"]) ?? ""),
      nguoi_gui: firstValue(item, ["sender", "nguoi_gui", "author", "from"]) ?? "",
      tro_giang: firstValue(item, ["ta", "tro_giang", "assistant"]) ?? "",
      loai_van_de: firstValue(item, ["type", "loai_van_de", "category"]) ?? "",
      noi_dung_loi: firstValue(item, ["error", "noi_dung_loi", "bug"]) ?? "",
      trang_thai: firstValue(item, ["status", "trang_thai"]) ?? "",
      ly_do: firstValue(item, ["reason", "ly_do"]) ?? "",
      thoi_gian: isoTime(firstValue(item, ["time", "thoi_gian", "created_at", "createdAt"])) ?? "",
      tho: item,
    };
  });
}

async function layThongBaoGiangVien(opts = {}) {
  return layNhomThongTin(
    ["/notifications", "/announcements", "/subjects/notifications"],
    tuyChon({ cookie: cookieCua(opts) }, opts.reLogin)
  );
}

async function layPhanHoiTroGiang(opts = {}) {
  return layNhomThongTin(
    ["/feedbacks/ta", "/feedbacks", "/supports"],
    tuyChon({ cookie: cookieCua(opts) }, opts.reLogin)
  );
}

async function layBaoLoiCauHoi(opts = {}) {
  return layNhomThongTin(
    ["/reports", "/feedbacks/reports", "/questions/reports"],
    tuyChon({ cookie: cookieCua(opts) }, opts.reLogin)
  );
}

async function layPhanHoiChatAI(opts = {}) {
  return layNhomThongTin(
    ["/feedbacks/ai", "/chat-ai/history", "/ai/history"],
    tuyChon({ cookie: cookieCua(opts) }, opts.reLogin)
  );
}

// --- Thong ke ---

function parseTienDo(value) {
  const match = String(value ?? "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) return { da_hoc: 0, tong_so: 0, phan_tram: null };
  const daHoc = Number(match[1]);
  const tongSo = Number(match[2]);
  return {
    da_hoc: daHoc,
    tong_so: tongSo,
    phan_tram: tongSo ? Math.round((daHoc / tongSo) * 10000) / 100 : null,
  };
}

async function layThongKe(opts = {}) {
  const thu = await thuLanLuot(
    ["/statistics", "/me/statistics", "/progress", "/me/progress"],
    { cookie: cookieCua(opts), reLogin: opts.reLogin, retry: false }
  );
  const duLieu = thu.data ? asList(thu.data, ["hoc_phan", "subjects", "items", "data"]) : [];
  if (duLieu.length) {
    return {
      hoc_phan: duLieu.map((hp) => ({
        ten_hoc_phan: firstValue(hp, ["name", "ten_hoc_phan", "subject"]) ?? "",
        tien_do_hoc_tap: {
          tong_so: Number(firstValue(hp, ["total", "tong_so"]) ?? 0) || 0,
          da_hoc: Number(firstValue(hp, ["done", "da_hoc", "completed"]) ?? 0) || 0,
          phan_tram: Number(firstValue(hp, ["percent", "phan_tram"]) ?? 0) || 0,
        },
        tat_ca_bai: Array.isArray(hp?.lessons ?? hp?.tat_ca_bai) ? (hp.lessons ?? hp.tat_ca_bai) : [],
      })),
    };
  }
  // Khong co endpoint thong ke: dung cau truc rong de map/ khong vo.
  void parallel;
  void firstValue;
  return { hoc_phan: [] };
}

module.exports = {
  layHocPhan,
  layChuongTrinhHoc,
  layHanHocPhan,
  layHanBaiTap,
  layLopHocPhan,
  layChiTietLopHocPhan,
  layNhom,
  laySlide,
  layNoiDungSlide,
  layDiemHocPhan,
  layDiemNhom,
  layBangDiem,
  mapDiemNhom,
  layBaiTap,
  mapExamData,
  layThongBaoGiangVien,
  layPhanHoiTroGiang,
  layBaoLoiCauHoi,
  layPhanHoiChatAI,
  layThongKe,
  parseTienDo,
};

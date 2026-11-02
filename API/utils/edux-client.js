/**
 * API/utils/edux-client.js
 * ===================================================================================
 * ADAPTER GỌI NHÁNH EDUX TỪ API SERVER (NODE THƯỜNG)
 * ===================================================================================
 * - Chỉ require CRWEB/modules/EDUX (Node thuần, không cần Electron).
 * - Cookie phiên do API giữ trong RAM (edux-session.js); mọi lời gọi đều truyền
 *   cookie tường minh, KHÔNG dùng cookie.txt trên đĩa.
 * - Adapter không log hoặc trả mật khẩu. edux-account.js quản lý tài khoản
 *   được nhớ trên máy để tự đăng nhập lại.
 * - Đọc hạn học phần qua /groups/get_subject_deadlines và hạn bài kiểm tra
 *   qua /exam/deadline/check/:modelId; giữ rõ nguồn hạn để frontend phân biệt.
 * ===================================================================================
 */

function loadEDUX() {
    // Require lười để API vẫn boot được nếu thiếu cụm EDUX.
    // eslint-disable-next-line global-require
    return require('../../CRWEB/modules/EDUX');
}

function s(value) {
    return value === null || value === undefined ? '' : String(value);
}

function soNguyen(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Đăng nhập EDUX bằng tài khoản người dùng cung cấp.
 * Không ghi cookie xuống đĩa (`luu: false`) — phiên chỉ sống trong RAM của API.
 *
 * @param {{email: string, password: string}} thongTin
 * @returns {Promise<{cookie: string, email: string}>}
 */
async function dangNhapEDUX({ email, password } = {}) {
    const mail = s(email).trim();
    const matKhau = s(password);
    if (!mail || !matKhau) {
        throw Object.assign(new Error('Email và mật khẩu EDUX là bắt buộc.'), { statusCode: 400 });
    }

    const edux = loadEDUX();
    try {
        const ketQua = await edux.loginEdux({ email: mail, password: matKhau, luu: false });
        return { cookie: ketQua.cookie, email: ketQua.email || mail };
    } catch (err) {
        // 401/403 từ EDUX = sai thông tin đăng nhập; các lỗi khác giữ nguyên mã.
        const statusCode = err.status === 401 || err.status === 403 ? 401 : (err.status >= 500 ? 502 : 400);
        throw Object.assign(
            new Error(err.message || 'Đăng nhập EDUX thất bại.'),
            { statusCode }
        );
    }
}

/**
 * Đọc tiến độ dạng "x/y" mà EDUX trả trong `process_document`.
 */
function docTienDo(value) {
    const match = s(value).match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return { daHoc: 0, tongSo: 0, phanTram: null };
    const daHoc = Number(match[1]);
    const tongSo = Number(match[2]);
    return {
        daHoc,
        tongSo,
        phanTram: tongSo ? Math.round((daHoc / tongSo) * 10000) / 100 : null
    };
}

/**
 * Nhãn trạng thái theo đúng bộ giá trị frontend đang dùng.
 */
function trangThai(tienDo) {
    if (!tienDo.tongSo) return 'Chưa làm';
    if (tienDo.daHoc >= tienDo.tongSo) return 'Hoàn thành';
    if (tienDo.daHoc > 0) return 'Đang làm';
    return 'Chưa làm';
}

/**
 * Một chương (model) có bài tập AI -> một bài tập hiển thị trên frontend.
 *
 * @param {object} subject Bản ghi /subjects/joined.
 * @param {object} model   Bản ghi /subjects/{id}/models.
 * @param {Array<object>} [cauHoi] Câu hỏi khi caller yêu cầu lấy chi tiết.
 */
function mapBaiTap(subject, model, cauHoi = null, thoiHan = { due: null, dueSource: null }) {
    const tienDo = docTienDo(model && model.process_document);
    const tenChuong = s(model && (model.title || model.name)).trim() || 'Chương học';
    const tenMon = s(subject && subject.name).trim() || 'Học phần EDUX';
    const diemCaoNhat = soNguyen(model && model.highest_score);

    return {
        // id ổn định để frontend chống trùng giữa các lần đồng bộ.
        id: `edux-${s(subject && subject.id)}-${s(model && model.id)}`,
        title: tenChuong,
        subject: tenMon,
        subjectId: s(subject && subject.id) || null,
        subjectCode: s(subject && subject.subject_code) || null,
        modelId: s(model && model.id) || null,
        chapter: s(model && model.chapter && (model.chapter.name || model.chapter.title)) || null,
        ...thoiHan,
        status: trangThai(tienDo),
        priority: 'Trung bình',
        description:
            `Bài tập AI môn ${tenMon} — ${tenChuong}. ` +
            (diemCaoNhat === null ? 'Chưa có điểm cao nhất.' : `Điểm cao nhất: ${diemCaoNhat}.`),
        progress: tienDo,
        highestScore: diemCaoNhat,
        questionCount: Array.isArray(cauHoi) ? cauHoi.length : null,
        questions: Array.isArray(cauHoi) ? cauHoi : undefined,
        source: 'EDUX',
        isLocalDraft: false
    };
}

function thoiGianHan(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value) && !Number.isNaN(Date.parse(value))) {
        const day = value.slice(0, 10), parsedDay = new Date(day + 'T00:00:00Z');
        if (!Number.isNaN(parsedDay.getTime()) && parsedDay.toISOString().slice(0, 10) === day) return value;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    throw Object.assign(new Error('EDUX trả về thời hạn không hợp lệ.'), { status: 502 });
}

/**
 * Kéo danh sách bài tập AI của toàn bộ học phần (hoặc 1 học phần) từ EDUX.
 *
 * @param {string} cookie Cookie phiên EDUX.
 * @param {{subjectId?: string, questions?: boolean, concurrency?: number}} [options]
 *   questions: gọi thêm POST /exam/start cho từng chương — thao tác này TẠO
 *   phiên làm bài mới trên EDUX nên mặc định tắt.
 * @returns {Promise<{assignments: Array<object>, subjects: number, thatBai: string[]}>}
 */
async function keoBaiTapEDUX(cookie, options = {}) {
    if (!cookie) {
        throw Object.assign(new Error('Chưa có phiên EDUX.'), { statusCode: 401 });
    }

    const { subjectId, questions = false, courseScope } = options;
    const edux = loadEDUX();
    const chung = { cookie, timeoutMs: options.timeoutMs, signal: options.signal };

    const tatCaHocPhan = await edux.layHocPhan(chung);
    const selected = subjectId
        ? tatCaHocPhan.filter(item => s(item && item.id) === s(subjectId))
        : tatCaHocPhan;
    const hocPhan = courseScope ? selected.filter(item => require('./current-courses').matchCourse(courseScope, item)) : selected;

    if (subjectId && !hocPhan.length) {
        throw Object.assign(new Error(`Không tìm thấy học phần ${subjectId} trên EDUX.`), { statusCode: 404 });
    }

    const { parallel } = require('../../CRWEB/modules/EDUX/utils');
    const concurrency = Math.max(1, Math.min(5, Number.isInteger(options.concurrency) ? options.concurrency : 3));
    const batches = await parallel(hocPhan, concurrency, async subject => {
        const assignments = [];
        const thatBai = [];
        const tenMon = s(subject && (subject.name || subject.subject_code)) || 'học phần';
        let models;
        try {
            models = await edux.layChuongTrinhHoc(subject.id, chung);
        } catch (err) {
            if (laHetPhien(err)) throw err;
            thatBai.push(`${tenMon}: ${err.message}`);
            return { assignments, thatBai };
        }

        const examModels = models.filter(model => model && model.exist_exam);
        if (!examModels.length) return { assignments, thatBai };
        // The portal reads the shared boundary once per subject; per-exam
        // deadlines are fetched in a bounded batch, never by starting an exam.
        const [hanMon, baiTap] = await Promise.all([
            (async () => {
                try {
                    const result = await edux.layHanHocPhan(subject.id, models.map(model => model?.id).filter(Boolean), chung);
                    return { subjectDeadline: thoiGianHan(result.max_deadline), subjectStartTime: thoiGianHan(result.start_time_subject) };
                } catch (err) {
                    if (laHetPhien(err)) throw err;
                    thatBai.push(`${tenMon}: Không lấy được hạn học phần. ${err.message}`);
                    return null;
                }
            })(),
            parallel(examModels, concurrency, async model => {
                let hanBai;
                try {
                    const result = await edux.layHanBaiTap(model.id, chung);
                    hanBai = thoiGianHan(result.exam_deadline);
                } catch (err) {
                    if (laHetPhien(err)) throw err;
                    // Older portals may not expose the effective exam route.
                    if ([404, 405].includes(Number(err.status || err.statusCode))) hanBai = null;
                    else thatBai.push(`${tenMon} / ${s(model.title || model.name)}: Không lấy được hạn bài kiểm tra. ${err.message}`);
                }
                let cauHoi = null;
                if (questions) {
                    try {
                        const ketQua = await edux.layBaiTap(model.id, chung);
                        cauHoi = ketQua.cau_hoi;
                    } catch (err) {
                        if (laHetPhien(err)) throw err;
                        thatBai.push(`${tenMon} / ${s(model.title || model.name)}: ${err.message}`);
                    }
                }
                return { model, hanBai, cauHoi };
            }),
        ]);
        for (const { model, hanBai, cauHoi } of baiTap) {
            const thoiHan = { ...(hanMon || {}) };
            if (hanBai) Object.assign(thoiHan, { due: hanBai, dueSource: 'exam' });
            else if (hanBai === null && hanMon) Object.assign(thoiHan, {
                due: hanMon.subjectDeadline, dueSource: hanMon.subjectDeadline ? 'subject' : null,
            });
            // Omit due when a lookup failed so persistence retains the last
            // known deadline instead of erasing it during a partial sync.
            assignments.push(mapBaiTap(subject, model, cauHoi, thoiHan));
        }
        return { assignments, thatBai };
    });

    return {
        assignments: batches.flatMap(batch => batch.assignments),
        subjects: hocPhan.length,
        subjectIds: hocPhan.map(item => s(item && item.id)).filter(Boolean),
        thatBai: batches.flatMap(batch => batch.thatBai)
    };
}

/**
 * Chuyển lỗi 401 của EDUX thành lỗi API để route xoá phiên và báo đăng nhập lại.
 */
function laHetPhien(err) {
    return !!err && [401, 403].includes(Number(err.statusCode || err.status));
}

module.exports = {
    dangNhapEDUX,
    keoBaiTapEDUX,
    mapBaiTap,
    docTienDo,
    laHetPhien
};

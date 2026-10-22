/**
 * API/shared/edux-client.js
 * ===================================================================================
 * ADAPTER GỌI NHÁNH EDUX TỪ API SERVER (NODE THƯỜNG)
 * ===================================================================================
 * - Chỉ require CRWEB/EDUX (Node thuần, không cần Electron).
 * - Cookie phiên do API giữ trong RAM (edux-session.js); mọi lời gọi đều truyền
 *   cookie tường minh, KHÔNG dùng cookie.txt trên đĩa.
 * - Mật khẩu EDUX chỉ đi qua đúng một lời gọi loginEdux() rồi bị bỏ; không log,
 *   không lưu, không trả ra response.
 * - EDUX không công bố endpoint hạn nộp, nên `due` luôn null: frontend hiển thị
 *   "Chưa đặt hạn" thay vì bịa deadline.
 * ===================================================================================
 */

function loadEDUX() {
    // Require lười để API vẫn boot được nếu thiếu cụm EDUX.
    // eslint-disable-next-line global-require
    return require('../../CRWEB/EDUX');
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
function mapBaiTap(subject, model, cauHoi = null) {
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
        // EDUX không công bố hạn nộp -> để null, frontend hiển thị "Chưa đặt hạn".
        due: null,
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

    const { subjectId, questions = false } = options;
    const edux = loadEDUX();
    const chung = { cookie };

    const tatCaHocPhan = await edux.layHocPhan(chung);
    const hocPhan = subjectId
        ? tatCaHocPhan.filter(item => s(item && item.id) === s(subjectId))
        : tatCaHocPhan;

    if (subjectId && !hocPhan.length) {
        throw Object.assign(new Error(`Không tìm thấy học phần ${subjectId} trên EDUX.`), { statusCode: 404 });
    }

    const assignments = [];
    const thatBai = [];

    for (const subject of hocPhan) {
        const tenMon = s(subject && (subject.name || subject.subject_code)) || 'học phần';
        let models;
        try {
            models = await edux.layChuongTrinhHoc(subject.id, chung);
        } catch (err) {
            if (err.status === 401) throw err;
            thatBai.push(`${tenMon}: ${err.message}`);
            continue;
        }

        for (const model of models) {
            if (!model || !model.exist_exam) continue;

            let cauHoi = null;
            if (questions) {
                try {
                    const ketQua = await edux.layBaiTap(model.id, chung);
                    cauHoi = ketQua.cau_hoi;
                } catch (err) {
                    if (err.status === 401) throw err;
                    thatBai.push(`${tenMon} / ${s(model.title || model.name)}: ${err.message}`);
                }
            }

            assignments.push(mapBaiTap(subject, model, cauHoi));
        }
    }

    return {
        assignments,
        subjects: hocPhan.length,
        subjectIds: hocPhan.map(item => s(item && item.id)).filter(Boolean),
        thatBai
    };
}

/**
 * Chuyển lỗi 401 của EDUX thành lỗi API để route xoá phiên và báo đăng nhập lại.
 */
function laHetPhien(err) {
    return !!err && err.status === 401;
}

module.exports = {
    dangNhapEDUX,
    keoBaiTapEDUX,
    mapBaiTap,
    docTienDo,
    laHetPhien
};

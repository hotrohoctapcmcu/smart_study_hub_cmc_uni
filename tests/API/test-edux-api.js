/**
 * API EDUX branch test — chạy bằng node, KHÔNG gọi EDUX thật.
 *
 * Dựng một HTTP server giả lập EDUX, trỏ API_BASE của cụm CRWEB/EDUX vào đó
 * rồi chạy toàn bộ luồng qua Express thật:
 *
 *   đăng nhập sai  -> 401, không tạo phiên
 *   đăng nhập đúng -> 201, phiên lưu RAM (không có mật khẩu)
 *   GET /tasks/edux -> bài tập đã chuẩn hoá đúng shape frontend
 *   cookie hết hạn -> 401 + phiên bị xoá
 *   logout         -> 200 + không còn phiên
 *
 * Chạy: node tests/API/test-edux-api.js (từ thư mục gốc dự án)
 */

"use strict";

const http = require("http");

const EDUX_PORT = 4599;
const EDUX_ORIGIN = `http://127.0.0.1:${EDUX_PORT}`;

// Cụm CRWEB/EDUX đọc ORIGIN/API_BASE lúc require -> phải set trước khi nạp API.
// Tuyệt đối không để test chạm tới edux.cmcu.edu.vn thật.
process.env.EDUX_ORIGIN = EDUX_ORIGIN;
process.env.EDUX_API_BASE = `${EDUX_ORIGIN}/api`;

// DB riêng cho test: không đụng data/unistudy.db thật, và mỗi lần chạy
// là một file mới nên kết quả không phụ thuộc dữ liệu còn sót lại.
const TEST_DB = require('path').resolve(__dirname, '../../data/test-edux.db');
try { require('fs').unlinkSync(TEST_DB); } catch {}
process.env.DB_PATH = TEST_DB;

let pass = 0;
let fail = 0;
function ok(cond, msg) {
    if (cond) { pass++; console.log(`  PASS ${msg}`); }
    else { fail++; console.log(`  FAIL ${msg}`); }
}

// ─── EDUX giả lập ────────────────────────────────────────────────────────
const DUNG_EMAIL = "sinhvien@st.cmcu.edu.vn";
const DUNG_MAT_KHAU = "mat-khau-dung";
const COOKIE_HOP_LE = "access_token=gia-lap-token";

const subjects = [
    { id: "sub-1", name: "Cấu trúc dữ liệu và giải thuật", subject_code: "CTDL" },
    { id: "sub-2", name: "Công nghệ phần mềm", subject_code: "CNPM" }
];
const modelsBySubject = {
    "sub-1": [
        { id: "m1", title: "Chương 1: Mảng và danh sách", exist_exam: true, process_document: "3/3", highest_score: 9 },
        { id: "m2", title: "Chương 2: Cây", exist_exam: true, process_document: "1/4", highest_score: 7 },
        { id: "m3", title: "Chương 3: Đồ thị", exist_exam: false, process_document: "0/2", highest_score: null }
    ],
    "sub-2": [
        { id: "m4", title: "Chương 1: Quy trình", exist_exam: true, process_document: "0/5", highest_score: null }
    ]
};

const requests = [];
const server = http.createServer((req, res) => {
    const url = new URL(req.url, EDUX_ORIGIN);
    requests.push({ method: req.method, path: url.pathname, cookie: req.headers.cookie || "" });

    const json = (status, body, extraHeaders = {}) => {
        res.writeHead(status, { "Content-Type": "application/json", ...extraHeaders });
        res.end(JSON.stringify(body));
    };

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
        let raw = "";
        req.on("data", (c) => { raw += c; });
        req.on("end", () => {
            let body = {};
            try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
            if (body.email === DUNG_EMAIL && body.password === DUNG_MAT_KHAU) {
                return json(200, { email: body.email, message: "Login successful" }, {
                    "Set-Cookie": `${COOKIE_HOP_LE}; Path=/; HttpOnly`
                });
            }
            return json(401, { detail: "Sai email hoặc mật khẩu" });
        });
        return;
    }

    if (req.headers.cookie !== COOKIE_HOP_LE) {
        return json(401, { detail: "Token hết hạn" });
    }

    if (req.method === "GET" && url.pathname === "/api/subjects/joined") {
        return json(200, { subjects });
    }
    const m = url.pathname.match(/^\/api\/subjects\/([^/]+)\/models$/);
    if (req.method === "GET" && m) {
        return json(200, { models: modelsBySubject[m[1]] || [] });
    }
    if (req.method === "POST" && url.pathname === "/api/exam/start") {
        return json(200, { session_id: "s1", exam_data: { multiple_choice: [{ question: "2+2?" }] } });
    }
    return json(404, { detail: `Không có route ${url.pathname}` });
});

// ─── API thật ────────────────────────────────────────────────────────────
async function main() {
    await new Promise((resolve) => server.listen(EDUX_PORT, "127.0.0.1", resolve));

    const apiModule = require("../../API/index");
    const apiServer = await apiModule.start();
    const API = `http://127.0.0.1:${apiServer.address().port}/api/v1`;

    const goi = async (method, route, body) => {
        const res = await fetch(`${API}${route}`, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        let json = null;
        try { json = await res.json(); } catch { json = null; }
        return { status: res.status, json };
    };

    try {
        console.log("== EDUX API BRANCH ==");

        // 1. Chưa đăng nhập
        let r = await goi("GET", "/sync/edux/status");
        ok(r.status === 200 && r.json.connected === false, "chưa đăng nhập -> status connected=false");
        ok(!("cookie" in r.json), "status không lộ cookie");

        r = await goi("GET", "/tasks/edux");
        ok(r.status === 401, "chưa có phiên -> GET /tasks/edux trả 401");

        r = await goi("POST", "/sync/edux/pull", {});
        ok(r.status === 401, "chưa có phiên -> POST /sync/edux/pull trả 401");

        // 2. Thiếu tham số
        r = await goi("POST", "/sync/edux/session", { email: DUNG_EMAIL });
        ok(r.status === 400, "thiếu mật khẩu -> 400");

        // 3. Sai mật khẩu
        r = await goi("POST", "/sync/edux/session", { email: DUNG_EMAIL, password: "sai-mat-khau" });
        ok(r.status === 401, "sai mật khẩu -> 401");
        ok(!JSON.stringify(r.json).includes("sai-mat-khau"), "không phản chiếu mật khẩu trong lỗi");

        r = await goi("GET", "/sync/edux/status");
        ok(r.json.connected === false, "đăng nhập sai không tạo phiên");

        // 4. Đăng nhập đúng
        r = await goi("POST", "/sync/edux/session", { email: DUNG_EMAIL, password: DUNG_MAT_KHAU });
        ok(r.status === 201 && r.json.connected === true, "đăng nhập đúng -> 201 + connected");
        ok(r.json.email === DUNG_EMAIL, "trả về email phiên");
        ok(!JSON.stringify(r.json).includes(DUNG_MAT_KHAU), "response không chứa mật khẩu");
        ok(!JSON.stringify(r.json).includes(COOKIE_HOP_LE), "response không chứa cookie");

        const eduxKho = require("../../API/shared/edux-session");
        const phien = eduxKho.getSession(1);
        ok(!!phien && phien.cookie === COOKIE_HOP_LE, "phiên lưu cookie trong RAM");
        ok(JSON.stringify(phien).indexOf(DUNG_MAT_KHAU) === -1, "phiên KHÔNG lưu mật khẩu");

        // 5. Kéo bài tập qua /tasks/edux
        r = await goi("GET", "/tasks/edux");
        ok(r.status === 200 && Array.isArray(r.json.data?.assignments), "GET /tasks/edux trả danh sách bài tập");
        const ds = r.json.data.assignments;
        ok(ds.length === 3, "chỉ lấy chương có bài tập AI (3/4 chương)");
        const bai = ds.find((x) => x.modelId === "m1");
        ok(!!bai, "có bài tập của chương m1");
        ok(bai.id === "edux-sub-1-m1", "id ổn định theo subject/model");
        ok(bai.title === "Chương 1: Mảng và danh sách", "title lấy từ tên chương");
        ok(bai.subject === "Cấu trúc dữ liệu và giải thuật", "subject lấy từ tên học phần");
        ok(bai.due === null, "due null vì EDUX không trả hạn nộp");
        ok(bai.status === "Hoàn thành", "tiến độ 3/3 -> Hoàn thành");
        ok(bai.source === "EDUX", "đánh dấu source EDUX");
        const bai2 = ds.find((x) => x.modelId === "m2");
        ok(bai2.status === "Đang làm", "tiến độ 1/4 -> Đang làm");
        ok(bai2.progress.tongSo === 4 && bai2.progress.daHoc === 1, "giữ tiến độ tài liệu");
        ok(ds.find((x) => x.modelId === "m4").status === "Chưa làm", "tiến độ 0/5 -> Chưa làm");

        // 6. Lọc theo học phần
        r = await goi("GET", "/tasks/edux?subjectId=sub-2");
        ok(r.status === 200 && r.json.data.assignments.length === 1, "lọc theo subjectId đúng");
        r = await goi("GET", "/tasks/edux?subjectId=khong-co");
        ok(r.status === 404, "subjectId không tồn tại -> 404");

        // 7. Lấy 1 bài theo id
        r = await goi("GET", "/tasks/edux/edux-sub-1-m1");
        ok(r.status === 200 && r.json.data.assignment.modelId === "m1", "GET /tasks/edux/:id trả đúng bài");
        r = await goi("GET", "/tasks/edux/khong-ton-tai");
        ok(r.status === 404, "id không tồn tại -> 404");

        // 8. Pull qua nhánh sync
        r = await goi("POST", "/sync/edux/pull", {});
        ok(r.status === 200 && r.json.assignments.length === 3, "POST /sync/edux/pull trả bài tập");
        ok(Array.isArray(r.json.thatBai), "pull trả thatBai để FE hiển thị");

        // 9. Cookie hết hạn -> 401 + xoá phiên
        eduxKho.saveSession(1, { cookie: "access_token=het-han", email: DUNG_EMAIL });
        r = await goi("GET", "/tasks/edux?refresh=1");
        ok(r.status === 401, "cookie hết hạn -> 401");
        ok(/hết hạn/i.test(r.json.message), "thông báo yêu cầu đăng nhập lại");
        ok(eduxKho.getSession(1) === null, "phiên hỏng bị xoá khỏi RAM");

        // 10. Logout
        await goi("POST", "/sync/edux/session", { email: DUNG_EMAIL, password: DUNG_MAT_KHAU });
        r = await goi("DELETE", "/sync/edux/session");
        ok(r.status === 200, "DELETE /sync/edux/session -> 200");
        r = await goi("GET", "/sync/edux/status");
        ok(r.json.connected === false, "sau logout không còn phiên");

        // 11. Nhánh IU không bị ảnh hưởng
        r = await goi("GET", "/sync/sources");
        const ids = (r.json.sources || []).map((s) => s.id);
        ok(ids.includes("IU") && ids.includes("EDUX"), "danh sách nguồn vẫn có IU + EDUX");
        r = await goi("GET", "/sync/iu/status");
        ok(r.status === 200 && "connected" in r.json, "nhánh IU vẫn phản hồi bình thường");

        // 12. Không ghi mật khẩu ra log
        const logs = [];
        const gocLog = console.log;
        const gocErr = console.error;
        console.log = (...a) => { logs.push(a.join(" ")); };
        console.error = (...a) => { logs.push(a.join(" ")); };
        try {
            await goi("POST", "/sync/edux/session", { email: DUNG_EMAIL, password: "sai-nua" });
        } finally {
            console.log = gocLog;
            console.error = gocErr;
        }
        ok(!logs.join("\n").includes("sai-nua"), "mật khẩu không xuất hiện trong log");

        // 13. Không có request nào mang cookie.txt cũ
        ok(requests.every((x) => x.path.startsWith("/api/")), "mọi request đều đi qua /api của EDUX");

    } finally {
        await new Promise((resolve) => apiServer.close(resolve));
        await new Promise((resolve) => server.close(resolve));
    }

    console.log(`\n==== EDUX API BRANCH: ${pass} PASS, ${fail} FAIL ====`);
    process.exit(fail ? 1 : 0);
}

main().catch((err) => {
    console.error("LỖI TEST:", err);
    process.exit(1);
});

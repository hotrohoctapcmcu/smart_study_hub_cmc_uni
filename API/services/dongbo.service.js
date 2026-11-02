'use strict';

const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { randomUUID } = require('node:crypto');
const iuKho = require('../utils/iu-session');
const { keoDuLieuIU, keoNhomIU, mapSangDataIU } = require('../utils/iu-client');
const eduxKho = require('../utils/edux-session');
const { keoBaiTapEDUX, laHetPhien } = require('../utils/edux-client');
const eduxAccounts = require('../utils/edux-account');
const { getCurrentCourseScope } = require('../utils/current-courses');

const { loi } = require('../utils/error');
const validate = require('../validators/dongbo.validator');

let db;
let iuPullInFlight = null;
let lastScheduleRefreshAt = 0;
const allSyncJobs = new Map();
const jobHistory = new Map();
const sourceHistory = new Map();
const SOURCE_IDS = ['IU', 'EDUX', 'OUTLOOK'];
const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);
const HISTORY_LIMIT = 50;
let latestJobId = null;
let allSyncQueue = Promise.resolve();
const DAY_MS = 24 * 60 * 60 * 1000;

function layCacNguonDongBo() {
    return [
        {
            id: 'IU',
            name: 'Cổng thông tin IU CMC',
            url: 'https://iu.cmcu.edu.vn/congthongtin/Index.aspx',
            description: 'Thời khóa biểu, bảng điểm, lịch thi, thông tin sinh viên',
            icon: 'university',
            isRequired: true
        },
        {
            id: 'EDUX',
            name: 'EduX CMC',
            url: 'https://edux.cmcu.edu.vn/',
            description: 'Bài giảng theo chương và bài tập AI của từng học phần',
            icon: 'book',
            isRequired: false
        },
        {
            id: 'OUTLOOK',
            name: 'Outlook trường',
            url: 'https://outlook.office.com/mail/inbox',
            description: 'Email và thông báo từ trường',
            icon: 'mail',
            isRequired: false
        }
    ].map(source => ({ ...source, ...sourceStatus(source.id) }));
}

function sourceStatus(source) {
    const session = source === 'IU' ? iuKho.getStatus(NGUOI_DUNG_ID)
        : source === 'EDUX' ? eduxKho.getStatus(NGUOI_DUNG_ID)
            : require('../../CRWEB/modules/OUTLOOK').status();
    const active = [...allSyncJobs.values()].map(record => record.job.results[source.toLowerCase()])
        .filter(result => result && !TERMINAL.has(result.status));
    const phase = active.some(result => result.status === 'RUNNING') ? 'RUNNING'
        : active.length ? 'PENDING' : null;
    const previous = sourceHistory.get(source);
    return { ...session, syncing: Boolean(phase), lastSync: previous?.lastSync || null,
        lastStatus: phase || previous?.lastStatus || 'IDLE' };
}

function layTrangThaiJob(jobId) {
    if (jobId !== undefined && (typeof jobId !== 'string' || !jobId.trim())) throw loi('jobId không hợp lệ.');
    const record = jobHistory.get(jobId || latestJobId);
    if (!record && jobId) throw loi('Không tìm thấy phiên đồng bộ.', 404);
    if (!record) return idleSnapshot();
    return snapshot(record.job);
}

function idleSnapshot() {
    return { jobId: null, status: 'IDLE', ok: null, sources: [...SOURCE_IDS],
        createdAt: null, startedAt: null, finishedAt: null, activeSource: null,
        progress: { completed: 0, total: 3, percent: 0 }, completedSources: [], failedSources: [], pendingSources: [],
        results: Object.fromEntries(SOURCE_IDS.map(source => [source.toLowerCase(), {
            status: 'IDLE', ok: null, synced: false, message: 'Chưa bắt đầu đồng bộ.', startedAt: null, finishedAt: null
        }])), message: 'Chưa có phiên đồng bộ.' };
}

function snapshot(job) {
    const completedSources = job.sources.filter(source => ['COMPLETED', 'PARTIAL'].includes(job.results[source.toLowerCase()].status));
    const failedSources = job.sources.filter(source => job.results[source.toLowerCase()].status === 'FAILED');
    const pendingSources = job.sources.filter(source => !TERMINAL.has(job.results[source.toLowerCase()].status));
    const completed = completedSources.length + failedSources.length;
    return { ...job, sources: [...job.sources], results: Object.fromEntries(Object.entries(job.results).map(([key, value]) => [key, { ...value, ...(value.counts && { counts: { ...value.counts } }) }])),
        completedSources, failedSources, pendingSources,
        progress: { completed, total: job.sources.length, percent: Math.round(completed / job.sources.length * 100) } };
}

function rememberSync(source, partial = false) {
    sourceHistory.set(source, { lastSync: new Date().toISOString(), lastStatus: partial ? 'PARTIAL' : 'COMPLETED' });
}

function safeCounts(source, response) {
    const input = source === 'IU' ? response?.savedDb : response;
    const allowed = source === 'IU' ? ['timetableCount', 'examsCount', 'gradesCount', 'subjectsCount']
        : source === 'EDUX' ? ['saved', 'removed'] : ['syncedCount'];
    return Object.fromEntries(allowed.filter(key => Number.isFinite(input?.[key]) && input[key] >= 0)
        .map(key => [key, input[key]]));
}

function markSourceFinished(job, source, response, error) {
    const previous = job.results[source.toLowerCase()];
    const finishedAt = new Date().toISOString();
    let result;
    if (error) {
        const statusCode = Number(error.statusCode || error.status) || 500;
        const requiresLogin = statusCode === 401 || statusCode === 403;
        result = { ...previous, status: 'FAILED', ok: false, synced: false, finishedAt, statusCode,
            ...(requiresLogin && { requiresLogin: true }),
            message: requiresLogin ? `Phiên ${source} chưa sẵn sàng hoặc đã hết hạn. Hãy kết nối lại.`
                : statusCode === 409 && source === 'EDUX' ? 'Chưa xác định được môn đang học. Hãy đồng bộ thời khóa biểu IU trước.'
                    : `Không thể đồng bộ ${source}. Vui lòng kiểm tra kết nối và thử lại.` };
        sourceHistory.set(source, { ...sourceHistory.get(source), lastStatus: 'FAILED' });
    } else {
        const warningCount = Array.isArray(response?.thatBai) ? response.thatBai.length : 0;
        const counts = safeCounts(source, response);
        result = { ...previous, status: warningCount ? 'PARTIAL' : 'COMPLETED', ok: !warningCount,
            synced: true, finishedAt, ...(Object.keys(counts).length && { counts }),
            ...(warningCount && { partial: true, warningCount }),
            message: warningCount ? `Đã đồng bộ một phần ${source}; ${warningCount} nhóm dữ liệu chưa lấy được.`
                : `Đã đồng bộ ${source}.` };
        rememberSync(source, Boolean(warningCount));
    }
    job.results[source.toLowerCase()] = result;
    job.activeSource = null;
}

function trimHistory() {
    for (const [id, record] of jobHistory) {
        if (jobHistory.size <= HISTORY_LIMIT) break;
        if (id !== latestJobId && TERMINAL.has(record.job.status)) jobHistory.delete(id);
    }
}

function createSyncJob(sources) {
    const key = sources.join(',');
    if (allSyncJobs.has(key)) return allSyncJobs.get(key);
    const job = {
        jobId: `sync_${NGUOI_DUNG_ID}_${randomUUID()}`, status: 'PENDING', ok: null, sources,
        createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, activeSource: null,
        results: Object.fromEntries(sources.map(source => [source.toLowerCase(), {
            status: 'PENDING', ok: null, synced: false, message: `Đang chờ đồng bộ ${source}.`, startedAt: null, finishedAt: null
        }])), message: 'Đã xếp hàng đồng bộ.'
    };
    const record = { job, completion: null };
    allSyncJobs.set(key, record);
    jobHistory.set(job.jobId, record);
    latestJobId = job.jobId;
    record.completion = allSyncQueue.then(() => runSyncJob(job)).finally(() => {
        allSyncJobs.delete(key);
        trimHistory();
    });
    allSyncQueue = record.completion.catch(() => {});
    trimHistory();
    return record;
}

async function runSyncJob(job) {
    job.status = 'RUNNING';
    job.startedAt = new Date().toISOString();
    job.message = 'Đang đồng bộ dữ liệu từ các nguồn.';
    try {
        const { createPortalWorkflow } = require('../../CRWEB');
        const { createWorkspaceService } = require('./workspace.service');
        const email = createWorkspaceService({ getDb: () => db, outlook: require('../../CRWEB/modules/OUTLOOK') });
        let iuResult;
        const operations = {
            IU: async () => { iuResult = await pullAndSaveIU({ refreshEdux: false }); return iuResult; },
            // If startup refresh was already fetching IU, it may have completed
            // its own EDUX cascade before this job joined. Reuse that result.
            EDUX: () => Array.isArray(iuResult?.eduxRefresh?.assignments)
                ? iuResult.eduxRefresh : pullAndSaveEdux(),
            OUTLOOK: () => email.syncEmails()
        };
        const workflow = createPortalWorkflow(Object.fromEntries(SOURCE_IDS.map(source => [source.toLowerCase(), {
            sync: async () => {
                job.activeSource = source;
                job.results[source.toLowerCase()] = { ...job.results[source.toLowerCase()], status: 'RUNNING', startedAt: new Date().toISOString(), message: `Đang đồng bộ ${source}.` };
                try {
                    const response = await operations[source]();
                    if (response?.ok === false) throw loi('Nguồn đồng bộ chưa hoàn tất.', Number(response.statusCode) || 502);
                    markSourceFinished(job, source, response);
                    return response;
                } catch (error) {
                    markSourceFinished(job, source, null, error);
                    throw error;
                }
            }
        }])));
        await workflow.syncAll({ sources: job.sources });
    } catch {
        // Unexpected infrastructure failures still terminate every pending source.
        for (const source of job.sources) {
            if (!TERMINAL.has(job.results[source.toLowerCase()].status)) markSourceFinished(job, source, null, {});
        }
    }
    const results = Object.values(job.results);
    job.ok = results.every(result => result.ok);
    job.status = job.ok ? 'COMPLETED' : results.some(result => result.synced) ? 'PARTIAL' : 'FAILED';
    job.finishedAt = new Date().toISOString();
    job.activeSource = null;
    job.message = job.ok ? 'Đã đồng bộ tất cả nguồn được chọn.'
        : job.status === 'PARTIAL' ? 'Đã đồng bộ một phần. Kiểm tra kết quả từng nguồn.' : 'Chưa đồng bộ được nguồn nào.';
    return snapshot(job);
}

async function layMaSinhVien(maSinhVien) {
    const tuIU = String(maSinhVien == null ? '' : maSinhVien).trim();
    if (tuIU) return tuIU;

    try {
        // Ứng dụng chỉ có một hồ sơ sinh viên duy nhất, nên lấy thẳng bản ghi đầu tiên
        // (không dùng layHoSo(NGUOI_DUNG_ID) vì student_id không nhất thiết bằng userId).
        const rows = await db.executeQuery(
            'SELECT student_code FROM Students ORDER BY student_id LIMIT 1'
        );
        const daLuu = rows.length ? String(rows[0].student_code || '').trim() : '';
        if (daLuu) return daLuu;
    } catch { /* DB chưa sẵn sàng — rơi xuống lỗi bên dưới */ }

    throw loi(
        'Không lấy được mã số sinh viên từ cổng IU. ' +
        'Hãy đăng nhập IU lại rồi đồng bộ để tải nhóm Hồ sơ sinh viên.'
    );
}

async function pullAndSaveIU(options = {}) {
    if (iuPullInFlight) return iuPullInFlight;
    iuPullInFlight = performIuPull(options);
    try { return await iuPullInFlight; }
    finally { iuPullInFlight = null; }
}

async function performIuPull(options) {
    const saved = iuKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { ngayBatDau, ngayKetThuc, soNgayLichThi, luuDb = true, refreshEdux = true } = options;
    let pulled;
    try {
        pulled = await keoDuLieuIU(saved.session, saved.cookie, { ngayBatDau, ngayKetThuc, soNgayLichThi });
    } catch (error) {
        if ([401, 403].includes(Number(error.statusCode || error.status))) {
            iuKho.clearSession(NGUOI_DUNG_ID);
            throw loi('Phiên IU đã hết hạn. Hãy kết nối IU lại.', 401);
        }
        throw error;
    }
    const { data, thatBai } = pulled;

    iuKho.saveSession(NGUOI_DUNG_ID, {
        session: saved.session,
        cookie: saved.cookie,
        data
    });

    const dataIU = mapSangDataIU(data);

    // saveIUData() khoá hồ sơ theo MÃ SỐ SINH VIÊN, không phải userId nội bộ.
    // Trước đây truyền NGUOI_DUNG_ID (number) nên .trim() ném TypeError.
    const studentCode = await layMaSinhVien(dataIU.MSV);

    const savedDb = luuDb
        ? await db.dongBoHoSoIU(studentCode, dataIU)
        : null;
    if (savedDb) rememberSync('IU', Boolean(thatBai?.length));


    let message = 'Đã kéo dữ liệu IU.';
    if (Array.isArray(thatBai) && thatBai.length) {
        message += ` Một số nhóm lỗi: ${thatBai.join('; ')}`;
    }

    const scheduleFetched = luuDb && Array.isArray(dataIU.tkb);
    if (scheduleFetched) lastScheduleRefreshAt = Date.now();
    let eduxRefresh = null;
    if (scheduleFetched && refreshEdux) {
        if (eduxKho.getSession(NGUOI_DUNG_ID)) {
            try { eduxRefresh = await pullAndSaveEdux(); }
            catch (error) { eduxRefresh = { refreshed: false, message: error.message }; }
        } else require('./learning-runtime.service').backgroundSync();
    }
    return { message, thatBai, savedDb, scheduleFetched, eduxRefresh, examRange: data.IU?.lich_thi?.range || null };
}

async function pullAndSaveEdux(body = {}) {
    const saved = await eduxKho.ensureSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);

    const { subjectId, questions = false } = body;
    const courseScope = await getCurrentCourseScope(db, NGUOI_DUNG_ID);
    if (!courseScope.resolved) throw loi(courseScope.message, 409);

    let ketQua;
    try {
        ketQua = await keoBaiTapEDUX(saved.cookie, { subjectId, questions: questions === true, courseScope });
    } catch (err) {
        // 401 = cookie EDUX hết hạn/không hợp lệ -> xoá phiên để FE yêu cầu đăng nhập lại.
        if (laHetPhien(err)) {
            eduxKho.clearSession(NGUOI_DUNG_ID);
            throw loi('Phiên EDUX đã hết hạn. Hãy đăng nhập EDUX lại.', 401);
        }
        throw err;
    }

    // Ghi đè dữ liệu đã kéo để lần sau chỉ cần đọc lại trong RAM.
    eduxKho.saveSession(NGUOI_DUNG_ID, {
        cookie: saved.cookie,
        email: saved.email,
        data: ketQua.assignments,
        subjectIds: ketQua.subjectIds
    });

    // Lưu hẳn xuống SQLite — trước đây chỉ có trong RAM nên tắt app là mất,
    // mở lại không thấy bài tập nào trong DB.
    const daLuu = await db.luuBaiTapEDUX(NGUOI_DUNG_ID, ketQua.assignments, { preserveExisting: true });
    rememberSync('EDUX', Boolean(ketQua.thatBai?.length));
    const learningJob = await require('./learning-runtime.service').backgroundSync();

    const soBai = ketQua.assignments.length;
    let message = `Đã kéo ${soBai} bài tập EDUX từ ${ketQua.subjects} học phần.`;
    if (daLuu.saved) message += ` Đã lưu ${daLuu.saved} bài vào cơ sở dữ liệu.`;
    if (daLuu.removed) message += ` Đã xoá ${daLuu.removed} bài không còn trên EDUX.`;
    if (ketQua.thatBai.length) {
        message += ` Một số chương lỗi: ${ketQua.thatBai.join('; ')}`;
    }

    return {
        message,
        learningJob,
        assignments: ketQua.assignments,
        thatBai: ketQua.thatBai,
        saved: daLuu.saved,
        removed: daLuu.removed
    };
}

async function refresh(body) {
    if (!iuKho.getSession(NGUOI_DUNG_ID)) return {
        refreshed: false, reason: 'session_required',
        message: 'Chưa có phiên IU. Kết nối IU để tự động cập nhật lịch học; dữ liệu đã lưu vẫn được giữ.',
        scope: await getCurrentCourseScope(db, NGUOI_DUNG_ID)
    };
    if (body?.startup !== true && lastScheduleRefreshAt && Date.now() - lastScheduleRefreshAt < DAY_MS) {
        return { refreshed: false, reason: 'up_to_date', lastRefreshedAt: new Date(lastScheduleRefreshAt).toISOString(), scope: await getCurrentCourseScope(db, NGUOI_DUNG_ID) };
    }
    const result = await pullAndSaveIU({ luuDb: true });
    return { ...result, refreshed: result.scheduleFetched,
        lastRefreshedAt: lastScheduleRefreshAt ? new Date(lastScheduleRefreshAt).toISOString() : null,
        scope: await getCurrentCourseScope(db, NGUOI_DUNG_ID) };
}

function syncAll(body = {}) {
    return createSyncJob(validate.syncRequest(body)).completion;
}

async function saveIuSession(body) {
    const { session, cookie, data, ttlMs } = body || {};
    const status = iuKho.saveSession(NGUOI_DUNG_ID, { session, cookie, data, ttlMs });

    return { message: 'Đã lưu phiên IU.', ...status };
}

async function clearIuSession() {
    iuKho.clearSession(NGUOI_DUNG_ID);
    return { message: 'Đã xoá phiên IU.' };
}

async function pullIuGroup(body) {
    const saved = iuKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { nhom, ...opts } = body || {};
    const data = await keoNhomIU(saved.session, saved.cookie, nhom, opts);

    return { nhom, data };
}

async function saveEduxSession(body) {
    const { email, password } = body || {};
    validate.credentials(email, password);
    const status = await eduxAccounts.connect(NGUOI_DUNG_ID, { email, password });
    return { message: 'Đã đăng nhập và lưu tài khoản EDUX trên máy này.', ...status };
}

async function clearEduxSession() {
    eduxAccounts.disconnect(NGUOI_DUNG_ID);
    require('../../CRWEB/modules/EDUX').logoutEdux();
    // Xoá cả bài tập EDUX đã lưu trong DB: ngắt kết nối nghĩa là không còn
    // dùng dữ liệu của cổng trường đó nữa.
    const daXoa = await db.xoaBaiTapEDUX(NGUOI_DUNG_ID);
    return { message: `Đã xoá phiên EDUX và ${daXoa} bài tập đã lưu.`, removed: daXoa };
}

module.exports = {
    setDb: instance => { db = instance; },
    sources: async () => { await eduxAccounts.restore(NGUOI_DUNG_ID); return { sources: layCacNguonDongBo() }; },
    start: (body = {}) => snapshot(createSyncJob(validate.syncRequest(body)).job),
    status: layTrangThaiJob,
    currentCourses: async () => ({ data: await getCurrentCourseScope(db, NGUOI_DUNG_ID) }),
    refresh, syncAll, saveIuSession, clearIuSession, pullIuGroup,
    iuStatus: () => sourceStatus('IU'),
    eduxStatus: async () => { await eduxAccounts.restore(NGUOI_DUNG_ID); return sourceStatus('EDUX'); },
    pullAndSaveIU, saveEduxSession, clearEduxSession, pullAndSaveEdux
};

const { executeQuery, withTransaction } = require('../connection/db');
const { chuanHoaMucUuTien } = require('../shared/academic');

function serializeDate(value) {
    return value instanceof Date ? value.toISOString() : value || null;
}

async function luuBaiTapEDUX(userId, assignments, { preserveExisting = false } = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!Array.isArray(assignments)) throw new Error('assignments phải là mảng');

    const uid = String(userId);

    let saved = 0;
    let removed = 0;

    await withTransaction(async () => {
        const giuLai = new Set();

        for (const item of assignments) {
            if (!item || !item.id) continue;

            const tienDo = item.progress || {};
            const docDone = Number(tienDo.daHoc) || 0;
            const docTotal = Number(tienDo.tongSo) || 0;
            const diemCaoNhat = Number.isFinite(Number(item.highestScore)) && item.highestScore !== null
                ? Number(item.highestScore)
                : null;

            const coHanNop = item.due !== undefined || item.deadline !== undefined;
            const hanNop = item.due !== undefined ? item.due : item.deadline;
            if (item.dueSource !== undefined && ![null, 'subject', 'exam'].includes(item.dueSource)) {
                throw new Error('dueSource phải là subject, exam hoặc null.');
            }

            await executeQuery(`
                INSERT INTO EduxAssignments (
                    user_id, external_id, title, subject_name, subject_ext_id,
                    model_id, chapter, description, status, priority,
                    highest_score, doc_done, doc_total, deadline,
                    deadline_source, subject_deadline, subject_start_time, synced_at
                ) VALUES (
                    @uid, @ext, @title, @subName, @subId,
                    @modelId, @chapter, @desc, @status, @priority,
                    @score, @docDone, @docTotal, @deadline,
                    @dueSource, @subjectDeadline, @subjectStartTime, datetime('now')
                )
                ON CONFLICT(user_id, external_id) DO UPDATE SET
                    title         = excluded.title,
                    subject_name  = excluded.subject_name,
                    subject_ext_id= excluded.subject_ext_id,
                    model_id      = excluded.model_id,
                    chapter       = excluded.chapter,
                    description   = excluded.description,
                    status        = CASE WHEN @hasStatus THEN excluded.status ELSE EduxAssignments.status END,
                    priority      = excluded.priority,
                    highest_score = excluded.highest_score,
                    doc_done      = excluded.doc_done,
                    doc_total     = excluded.doc_total,
                    deadline      = CASE WHEN @hasDeadline THEN excluded.deadline ELSE EduxAssignments.deadline END,
                    deadline_source = CASE WHEN @hasDueSource THEN excluded.deadline_source ELSE EduxAssignments.deadline_source END,
                    subject_deadline = CASE WHEN @hasSubjectDeadline THEN excluded.subject_deadline ELSE EduxAssignments.subject_deadline END,
                    subject_start_time = CASE WHEN @hasSubjectStartTime THEN excluded.subject_start_time ELSE EduxAssignments.subject_start_time END,
                    synced_at     = datetime('now'),
                    updated_at    = datetime('now')
            `, {
                uid,
                ext: String(item.id),
                title: item.title || 'Bài tập EDUX',
                subName: item.subject || null,
                subId: item.subjectId ? String(item.subjectId) : null,
                modelId: item.modelId ? String(item.modelId) : null,
                chapter: item.chapter || null,
                desc: item.description || null,
                status: item.status || 'Chưa làm',
                hasStatus: item.status !== undefined ? 1 : 0,
                priority: chuanHoaMucUuTien(item.priority),
                score: diemCaoNhat,
                docDone,
                docTotal,
                deadline: serializeDate(hanNop),
                hasDeadline: coHanNop ? 1 : 0,
                dueSource: item.dueSource ?? null,
                hasDueSource: item.dueSource !== undefined ? 1 : 0,
                subjectDeadline: serializeDate(item.subjectDeadline),
                hasSubjectDeadline: item.subjectDeadline !== undefined ? 1 : 0,
                subjectStartTime: serializeDate(item.subjectStartTime),
                hasSubjectStartTime: item.subjectStartTime !== undefined ? 1 : 0
            });

            giuLai.add(String(item.id));
            saved++;
        }

        const hienCo = await executeQuery(
            'SELECT external_id FROM EduxAssignments WHERE user_id = @uid',
            { uid }
        );
        for (const row of preserveExisting ? [] : hienCo) {
            if (giuLai.has(row.external_id)) continue;
            await executeQuery(
                'DELETE FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext',
                { uid, ext: row.external_id }
            );
            removed++;
        }
    });

    return { saved, removed };
}

async function layBaiTapEDUX(userId, opts = {}) {
    if (!userId) throw new Error('userId là bắt buộc');

    const uid = String(userId);
    const params = { uid };
    let sqlText = 'SELECT * FROM EduxAssignments WHERE user_id = @uid';
    if (!opts.includeHidden) sqlText += ' AND is_hidden = 0';

    if (opts.subjectId) {
        sqlText += ' AND subject_ext_id = @subId';
        params.subId = String(opts.subjectId);
    }

    sqlText += ' ORDER BY subject_name ASC, chapter ASC, title ASC';

    const rows = await executeQuery(sqlText, params);

    return rows.map(row => ({
        id: row.external_id,
        tags: JSON.parse(row.tags || '[]'),
        title: row.title,
        subject: row.subject_name || 'Học phần EDUX',
        subjectId: row.subject_ext_id,
        modelId: row.model_id,
        chapter: row.chapter,
        due: row.deadline || null,
        dueSource: row.deadline_source || null,
        subjectDeadline: row.subject_deadline || null,
        subjectStartTime: row.subject_start_time || null,
        status: row.status,
        priority: row.priority === 'HIGH' ? 'Cao'
            : row.priority === 'LOW' ? 'Thấp'
            : row.priority === 'URGENT' ? 'Khẩn cấp'
            : 'Trung bình',
        description: row.description || '',
        progress: { daHoc: row.doc_done, tongSo: row.doc_total },
        highestScore: row.highest_score,
        source: 'EDUX',
        isLocalDraft: false,
        syncedAt: row.synced_at,
        ...(opts.includeHidden && { isHidden: Number(row.is_hidden) === 1 })
    }));
}

async function anBaiTapEDUX(userId, externalId) {
    if (!userId || !externalId) throw new Error('userId và externalId là bắt buộc');

    const uid = String(userId);
    const ext = String(externalId);
    const rows = await executeQuery(
        'SELECT 1 FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext LIMIT 1',
        { uid, ext }
    );
    if (rows.length === 0) return false;

    await executeQuery(`
        UPDATE EduxAssignments
        SET is_hidden = 1, updated_at = datetime('now')
        WHERE user_id = @uid AND external_id = @ext
    `, { uid, ext });
    return true;
}

async function capNhatTrangThaiBaiTapEDUX(userId, externalId, trangThai) {
    if (!userId || !externalId) throw new Error('userId và externalId là bắt buộc');

    const uid = String(userId);

    await executeQuery(`
        UPDATE EduxAssignments
        SET status = @st, updated_at = datetime('now')
        WHERE user_id = @uid AND external_id = @ext
    `, { st: trangThai || 'Chưa làm', uid, ext: String(externalId) });

    const res = await executeQuery(
        'SELECT * FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext',
        { uid, ext: String(externalId) }
    );
    return res.length > 0 ? res[0] : null;
}

async function xoaBaiTapEDUX(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const uid = String(userId);

    const truoc = await executeQuery(
        'SELECT COUNT(*) AS so_luong FROM EduxAssignments WHERE user_id = @uid',
        { uid }
    );
    await executeQuery('DELETE FROM EduxAssignments WHERE user_id = @uid', { uid });
    return truoc.length ? Number(truoc[0].so_luong) || 0 : 0;
}

module.exports = {
    luuBaiTapEDUX,
    layBaiTapEDUX,
    anBaiTapEDUX,
    capNhatTrangThaiBaiTapEDUX,
    xoaBaiTapEDUX
};

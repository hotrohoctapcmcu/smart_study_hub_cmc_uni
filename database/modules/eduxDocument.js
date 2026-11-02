'use strict';

const { executeQuery, beginTransaction, commitTransaction, rollbackTransaction } = require('../connection/db');
const { layStudentId } = require('../shared/studyStudent');

async function dongBoEdux(studentId, documents = []) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!Array.isArray(documents)) throw new Error('documents phải là một mảng');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(
        `INSERT INTO EduxSyncLog (student_id, sync_type, status)
         VALUES (@sid, 'FULL', 'IN_PROGRESS')`,
        { sid }
    );
    const syncLogRes = await executeQuery(
        'SELECT last_insert_rowid() AS sync_id'
    );
    const syncId = syncLogRes.length > 0 ? syncLogRes[0].sync_id : null;

    const existingDocs = await executeQuery(
        'SELECT * FROM EduxDocuments WHERE student_id = @sid',
        { sid }
    );
    const rollbackData = JSON.stringify(existingDocs);

    let syncedCount = 0;
    let failedCount = 0;
    const errors = [];

    try {
        await beginTransaction();

        for (const doc of documents) {
            try {
                if (!doc || typeof doc.title !== 'string' || !doc.title.trim()) {
                    throw new Error('Tài liệu phải có tiêu đề');
                }

                const subjectId = doc.subjectId
                    ? parseInt(doc.subjectId, 10)
                    : null;

                await executeQuery(
                    `INSERT INTO EduxDocuments
                        (student_id, subject_id, external_id, title, description,
                         file_url, file_type, file_size, category,
                         semester, academic_year, uploaded_by, source, synced_at)
                     VALUES
                        (@sid, @subId, @extId, @title, @desc,
                         @url, @ft, @fs, @cat,
                         @sem, @ay, @ub, 'EDUX', datetime('now'))
                     ON CONFLICT(student_id, external_id) DO UPDATE SET
                         title = excluded.title,
                         description = excluded.description,
                         file_url = excluded.file_url,
                         file_type = excluded.file_type,
                         file_size = excluded.file_size,
                         category = COALESCE(excluded.category, EduxDocuments.category),
                         synced_at = datetime('now'),
                         is_deleted_on_source = 0,
                         updated_at = datetime('now')`,
                    {
                        sid,
                        subId: subjectId,
                        extId: doc.externalId || null,
                        title: doc.title,
                        desc: doc.description || null,
                        url: doc.fileUrl || null,
                        ft: doc.fileType || null,
                        fs: doc.fileSize || null,
                        cat: doc.category || 'GENERAL',
                        sem: doc.semester || null,
                        ay: doc.academicYear || null,
                        ub: doc.uploadedBy || null,
                    }
                );
                syncedCount++;
            } catch (docErr) {
                failedCount++;
                errors.push(
                    `Lỗi tài liệu "${doc?.title || ''}": ${docErr.message}`
                );
                throw docErr;
            }
        }

        const externalIds = documents.map(doc => doc.externalId).filter(Boolean);
        if (externalIds.length > 0) {
            const placeholders = externalIds.map((_, i) => `@eid${i}`).join(',');
            const eidParams = Object.fromEntries(externalIds.map((id, i) => [`eid${i}`, id]));

            await executeQuery(
                `UPDATE EduxDocuments
                 SET is_deleted_on_source = 1, updated_at = datetime('now')
                 WHERE student_id = @sid
                   AND external_id IS NOT NULL
                   AND external_id NOT IN (${placeholders})`,
                { sid, ...eidParams }
            );
        }

        await commitTransaction();

        await executeQuery(
            `UPDATE EduxSyncLog
             SET status = @st,
                 items_synced = @is,
                 items_failed = @if2,
                 completed_at = datetime('now'),
                 rollback_data = @rd,
                 error_message = @em
             WHERE sync_id = @sid2`,
            {
                st: failedCount > 0 ? 'FAILED' : 'SUCCESS',
                is: syncedCount,
                if2: failedCount,
                rd: rollbackData,
                em: errors.length > 0 ? errors.join('; ') : null,
                sid2: syncId,
            }
        );

        return {
            syncId,
            syncedCount,
            failedCount,
            errors,
            success: failedCount === 0,
        };
    } catch (err) {
        try {
            await rollbackTransaction();
        } catch (_) {}

        if (syncId) {
            await executeQuery(
                `UPDATE EduxSyncLog
                 SET status = 'FAILED',
                     error_message = @em,
                     completed_at = datetime('now'),
                     rollback_data = @rd
                 WHERE sync_id = @sid2`,
                {
                    em: err.message,
                    rd: rollbackData,
                    sid2: syncId,
                }
            );
        }

        console.error('[EDUX] Đồng bộ EDUX thất bại, đã ROLLBACK:', err.message);
        throw err;
    }
}

async function rollbackEdux(syncId) {
    if (!syncId) throw new Error('syncId là bắt buộc');

    const logRows = await executeQuery(
        'SELECT * FROM EduxSyncLog WHERE sync_id = @sid',
        { sid: parseInt(syncId, 10) }
    );
    if (!logRows.length) throw new Error('Không tìm thấy log đồng bộ');

    const log = logRows[0];
    if (!log.rollback_data) throw new Error('Không có dữ liệu rollback');

    const oldDocs = JSON.parse(log.rollback_data);

    try {
        await beginTransaction();

        await executeQuery(
            'DELETE FROM EduxDocuments WHERE student_id = @sid',
            { sid: log.student_id }
        );

        for (const doc of oldDocs) {
            await executeQuery(
                `INSERT INTO EduxDocuments
                    (document_id, student_id, subject_id, external_id, title, description,
                     file_url, file_type, file_size, category,
                     semester, academic_year, uploaded_by, source,
                     synced_at, is_deleted_on_source, created_at, updated_at)
                 VALUES
                    (@did, @sid, @subId, @extId, @title, @desc,
                     @url, @ft, @fs, @cat,
                     @sem, @ay, @ub, @src,
                     @sa, @ids, @ca, @ua)`,
                {
                    did: doc.document_id,
                    sid: doc.student_id,
                    subId: doc.subject_id,
                    extId: doc.external_id,
                    title: doc.title,
                    desc: doc.description,
                    url: doc.file_url,
                    ft: doc.file_type,
                    fs: doc.file_size,
                    cat: doc.category,
                    sem: doc.semester,
                    ay: doc.academic_year,
                    ub: doc.uploaded_by,
                    src: doc.source,
                    sa: doc.synced_at,
                    ids: doc.is_deleted_on_source,
                    ca: doc.created_at,
                    ua: doc.updated_at,
                }
            );
        }

        await commitTransaction();

        await executeQuery(
            `UPDATE EduxSyncLog
             SET status = 'ROLLED_BACK'
             WHERE sync_id = @sid`,
            { sid: parseInt(syncId, 10) }
        );

        await executeQuery(
            `INSERT INTO EduxSyncLog (student_id, sync_type, status, items_synced, completed_at)
             VALUES (@sid, 'ROLLBACK', 'SUCCESS', @cnt, datetime('now'))`,
            { sid: log.student_id, cnt: oldDocs.length }
        );

        return { success: true, restoredCount: oldDocs.length };
    } catch (err) {
        try {
            await rollbackTransaction();
        } catch (_) {}
        console.error('[EDUX] Rollback thất bại:', err.message);
        throw err;
    }
}

async function layTaiLieuEdux(studentId, filters = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let extraFilter = '';
    const params = { sid };

    if (filters.subjectId) {
        extraFilter += ' AND d.subject_id = @subId';
        params.subId = parseInt(filters.subjectId, 10);
    }
    if (filters.category) {
        extraFilter += ' AND d.category = @cat';
        params.cat = filters.category;
    }
    if (!filters.includeDeleted) {
        extraFilter += ' AND d.is_deleted_on_source = 0';
    }

    return await executeQuery(
        `SELECT d.document_id, d.student_id, d.subject_id,
                sub.subject_code, sub.subject_name,
                d.external_id, d.title, d.description,
                d.file_url, d.file_type, d.file_size, d.category,
                d.semester, d.academic_year, d.uploaded_by,
                d.source, d.synced_at, d.is_deleted_on_source,
                d.created_at, d.updated_at
         FROM EduxDocuments d
         LEFT JOIN Subjects sub ON d.subject_id = sub.subject_id
         WHERE d.student_id = @sid ${extraFilter}
         ORDER BY d.synced_at DESC, d.title ASC`,
        params
    );
}

async function layLogDongBoEdux(studentId, limit = 20) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT sync_id, student_id, sync_type, status,
                items_synced, items_failed, error_message,
                started_at, completed_at
         FROM EduxSyncLog
         WHERE student_id = @sid
         ORDER BY started_at DESC
         LIMIT @lim`,
        { sid, lim: limit }
    );
}

module.exports = {
    dongBoEdux,
    rollbackEdux,
    layTaiLieuEdux,
    layLogDongBoEdux,
};

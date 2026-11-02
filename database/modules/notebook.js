'use strict';

const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/studyStudent');

async function taoSoTay(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.title) throw new Error('title là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(
        `INSERT INTO Notebooks (student_id, subject_id, title, description, color, icon)
         VALUES (@sid, @subId, @title, @desc, @color, @icon)`,
        {
            sid,
            subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
            title: data.title,
            desc: data.description || null,
            color: data.color || '#4A90D9',
            icon: data.icon || '📒',
        }
    );

    const idRes = await executeQuery('SELECT last_insert_rowid() AS notebook_id');
    return idRes.length > 0 ? idRes[0] : null;
}

async function layDanhSachSoTay(studentId, includeArchived = false) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    const archiveFilter = includeArchived ? '' : 'AND nb.is_archived = 0';

    return await executeQuery(
        `SELECT nb.notebook_id, nb.student_id, nb.subject_id,
                sub.subject_code, sub.subject_name,
                nb.title, nb.description, nb.color, nb.icon,
                nb.is_archived, nb.created_at, nb.updated_at,
                (SELECT COUNT(1) FROM Notes n WHERE n.notebook_id = nb.notebook_id) AS notes_count,
                (SELECT COUNT(1) FROM Notes n WHERE n.notebook_id = nb.notebook_id AND n.is_hard = 1) AS hard_notes_count
         FROM Notebooks nb
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE nb.student_id = @sid ${archiveFilter}
         ORDER BY nb.updated_at DESC`,
        { sid }
    );
}

async function capNhatSoTay(notebookId, data = {}) {
    if (!notebookId) throw new Error('notebookId là bắt buộc');

    await executeQuery(
        `UPDATE Notebooks
         SET title = COALESCE(@title, title),
             description = COALESCE(@desc, description),
             color = COALESCE(@color, color),
             icon = COALESCE(@icon, icon),
             is_archived = COALESCE(@arch, is_archived),
             updated_at = datetime('now')
         WHERE notebook_id = @nid`,
        {
            title: data.title || null,
            desc: data.description || null,
            color: data.color || null,
            icon: data.icon || null,
            arch: data.isArchived != null ? (data.isArchived ? 1 : 0) : null,
            nid: parseInt(notebookId, 10),
        }
    );

    const res = await executeQuery(
        'SELECT * FROM Notebooks WHERE notebook_id = @nid',
        { nid: parseInt(notebookId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

async function xoaSoTay(notebookId) {
    if (!notebookId) throw new Error('notebookId là bắt buộc');
    await executeQuery('DELETE FROM Notebooks WHERE notebook_id = @nid', {
        nid: parseInt(notebookId, 10),
    });
    return true;
}

async function themGhiChu(studentId, notebookId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!notebookId) throw new Error('notebookId là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    const nbRows = await executeQuery(
        'SELECT 1 FROM Notebooks WHERE notebook_id = @nid AND student_id = @sid LIMIT 1',
        { nid: parseInt(notebookId, 10), sid }
    );
    if (!nbRows.length)
        throw new Error('Sổ tay không tồn tại hoặc không thuộc quyền sở hữu');

    const maxOrder = await executeQuery(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM Notes WHERE notebook_id = @nid',
        { nid: parseInt(notebookId, 10) }
    );

    const tags =
        Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags || null;

    await executeQuery(
        `INSERT INTO Notes (notebook_id, student_id, chapter, title, content, tags, is_hard, is_favorite, sort_order)
         VALUES (@nid, @sid, @ch, @title, @content, @tags, @hard, @fav, @so)`,
        {
            nid: parseInt(notebookId, 10),
            sid,
            ch: data.chapter || null,
            title: data.title || 'Ghi chú mới',
            content: data.content || null,
            tags,
            hard: data.isHard ? 1 : 0,
            fav: data.isFavorite ? 1 : 0,
            so: maxOrder.length > 0 ? maxOrder[0].next_order : 0,
        }
    );

    const idRes = await executeQuery('SELECT last_insert_rowid() AS note_id');
    return idRes.length > 0 ? idRes[0] : null;
}

async function layGhiChuTheoSoTay(notebookId, filters = {}) {
    if (!notebookId) throw new Error('notebookId là bắt buộc');

    let extraFilter = '';
    const params = { nid: parseInt(notebookId, 10) };

    if (filters.isHard) {
        extraFilter += ' AND n.is_hard = 1';
    }
    if (filters.isFavorite) {
        extraFilter += ' AND n.is_favorite = 1';
    }
    if (filters.chapter) {
        extraFilter += ' AND n.chapter = @ch';
        params.ch = filters.chapter;
    }
    if (filters.searchTerm) {
        extraFilter +=
            ' AND (n.title LIKE @q OR n.content LIKE @q OR n.tags LIKE @q)';
        params.q = `%${filters.searchTerm}%`;
    }

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite, n.sort_order,
                n.created_at, n.updated_at
         FROM Notes n
         WHERE n.notebook_id = @nid ${extraFilter}
         ORDER BY n.sort_order ASC, n.updated_at DESC`,
        params
    );
}

async function layGhiChuKho(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                nb.title AS notebook_title,
                sub.subject_name,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite, n.sort_order,
                n.created_at, n.updated_at
         FROM Notes n
         INNER JOIN Notebooks nb ON n.notebook_id = nb.notebook_id
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE n.student_id = @sid AND n.is_hard = 1
         ORDER BY n.updated_at DESC`,
        { sid }
    );
}

async function capNhatGhiChu(noteId, data = {}) {
    if (!noteId) throw new Error('noteId là bắt buộc');

    const tags =
        Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags || null;

    await executeQuery(
        `UPDATE Notes
         SET chapter = COALESCE(@ch, chapter),
             title = COALESCE(@title, title),
             content = COALESCE(@content, content),
             tags = COALESCE(@tags, tags),
             is_hard = COALESCE(@hard, is_hard),
             is_favorite = COALESCE(@fav, is_favorite),
             sort_order = COALESCE(@so, sort_order),
             updated_at = datetime('now')
         WHERE note_id = @nid`,
        {
            ch: data.chapter || null,
            title: data.title || null,
            content: data.content !== undefined ? data.content : null,
            tags,
            hard: data.isHard != null ? (data.isHard ? 1 : 0) : null,
            fav: data.isFavorite != null ? (data.isFavorite ? 1 : 0) : null,
            so: data.sortOrder ?? null,
            nid: parseInt(noteId, 10),
        }
    );

    const res = await executeQuery(
        'SELECT * FROM Notes WHERE note_id = @nid',
        { nid: parseInt(noteId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

async function xoaGhiChu(noteId) {
    if (!noteId) throw new Error('noteId là bắt buộc');
    await executeQuery('DELETE FROM Notes WHERE note_id = @nid', {
        nid: parseInt(noteId, 10),
    });
    return true;
}

async function timKiemGhiChu(studentId, searchTerm) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!searchTerm) return [];

    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                nb.title AS notebook_title,
                sub.subject_name,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite,
                n.created_at, n.updated_at
         FROM Notes n
         INNER JOIN Notebooks nb ON n.notebook_id = nb.notebook_id
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE n.student_id = @sid
           AND (n.title LIKE @q OR n.content LIKE @q OR n.tags LIKE @q OR n.chapter LIKE @q)
         ORDER BY n.updated_at DESC
         LIMIT 50`,
        { sid, q: `%${searchTerm}%` }
    );
}

module.exports = {
    taoSoTay,
    layDanhSachSoTay,
    capNhatSoTay,
    xoaSoTay,
    themGhiChu,
    layGhiChuTheoSoTay,
    layGhiChuKho,
    capNhatGhiChu,
    xoaGhiChu,
    timKiemGhiChu,
};

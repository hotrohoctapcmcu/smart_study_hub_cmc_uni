'use strict';
const fs = require('node:fs/promises');
const { createWorkspaceService } = require('./workspace.service');
const { getCurrentCourseScope, matchCourse } = require('../utils/current-courses');
const { fail } = require('../validators/hoctapai.validator');
const parse = value => { try { return JSON.parse(value); } catch { return []; } };

async function resolveQuizSource(source, { getDb, userId, subject }) {
    const db = getDb();
    const scope = await getCurrentCourseScope(db, userId);
    if (!scope.resolved) throw fail(scope.message, 409);
    const chosen = matchCourse(scope, { subject });
    if (!chosen) throw fail('Môn nguồn không thuộc kỳ hiện tại.', 409);
    if (source?.uploadId) {
        const workspace = createWorkspaceService({ getDb, userId });
        const doc = (await workspace.documents()).find(d => String(d.id) === String(source.uploadId));
        if (!doc) throw fail('Không tìm thấy tài liệu nguồn của bạn.', 404);
        if (doc.subjectId ? Number(doc.subjectId) !== Number(chosen.subjectId) : !matchCourse({ resolved: true, courses: [chosen] }, { subject: doc.subject })) throw fail('Tài liệu nguồn không khớp môn đã chọn.');
        if (!['TXT', 'MD'].includes(doc.fileType)) throw fail('Chưa trích xuất được văn bản từ định dạng này. Chọn bài giảng có nội dung hoặc tệp TXT/Markdown; chưa có tài liệu nào được dùng.', 422);
        const file = await workspace.documentFile(doc.id);
        const content = file.path ? await fs.readFile(file.path, 'utf8') : '';
        if (!content.trim() || content.length > 15000) throw fail('Nguồn cần có văn bản và tối đa 15.000 ký tự. Hãy tách nội dung thành phần nhỏ.', 422);
        return { text: content, evidence: { kind: 'upload', id: doc.id, title: doc.title, chars: content.length } };
    }
    if (!source?.courseId) throw fail('Nguồn quiz không hợp lệ.');
    const [course] = await db.executeQuery('SELECT * FROM LearningCourses WHERE user_id=@uid AND course_id=@id', { uid: userId, id: String(source.courseId) });
    if (!course || !matchCourse({ resolved: true, courses: [chosen] }, course)) throw fail('Bài giảng nguồn không khớp môn đã chọn.', 404);
    const chapters = parse(course.chapters_json).filter(ch => !source.chapterId || String(ch.id) === String(source.chapterId));
    const documents = chapters.flatMap(ch => (ch.documents || []).filter(d => !source.documentId || String(d.id) === String(source.documentId)).map(d => ({ ...d, chapter: ch.title })));
    if (!documents.length || documents.some(d => d.status !== 'ready' || d.cached)) throw fail('Tài liệu nguồn chưa đầy đủ hoặc đã lỗi thời. Hãy đồng bộ lại.', 409);
    const ready = documents.map(d => ({ ...d, text: typeof d.content === 'string' && d.content.trim() ? d.content.trim() : typeof d.rawContent === 'string' ? d.rawContent.trim() : '' }));
    if (ready.some(d => !d.text)) throw fail('Nguồn chưa có văn bản đọc được. Chưa dùng ảnh hoặc tệp đính kèm để tạo quiz.', 422);
    const content = ready.map(d => `${d.chapter} · ${d.title}\n${d.text}`).join('\n\n');
    if (content.length > 15000) throw fail('Nguồn vượt 15.000 ký tự. Hãy chọn một chương hoặc tài liệu nhỏ hơn.', 422);
    return { text: content, evidence: { kind: 'course', id: course.course_id, title: course.subject_name, chars: content.length,
        documents: ready.map(d => ({ id: d.id, title: d.title, chapter: d.chapter })) } };
}
module.exports = { resolveQuizSource };

'use strict';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 20000;
const text = value => value == null ? '' : String(value);
const { cacheSlideImages } = require('./edux-slide-images');

function decodeEntities(value) {
    const entities = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    return value.replace(/&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (match, name) => {
        if (name[0] !== '#') return entities[name.toLowerCase()] ?? match;
        const point = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    });
}

function htmlText(value) {
    return decodeEntities(value
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<!--[^]*?-->/g, '')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n• ')
        .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|blockquote|pre|ul|ol)\s*>/gi, '\n')
        .replace(/<\/(?:td|th)\s*>/gi, '\t')
        .replace(/<\/?(?:html|head|body|title|p|div|span|h[1-6]|a|strong|b|i|em|u|s|small|sub|sup|code|pre|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|section|article|blockquote|figure|figcaption|img|hr)\b[^>]*>/gi, ''))
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
}

/** Convert HTML or common editor JSON to readable text; retain rawContent too. */
function materialText(value, depth = 0) {
    if (depth > 40 || value == null) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^[\[{]/.test(trimmed)) {
            try { return materialText(JSON.parse(trimmed), depth + 1); } catch { /* ordinary text/code */ }
        }
        return htmlText(value);
    }
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return value.map(item => materialText(item, depth + 1)).filter(Boolean).join('\n');
    if (typeof value.text === 'string') return htmlText(value.text);
    if (typeof value.insert === 'string') return htmlText(value.insert);
    if (Array.isArray(value.ops)) return value.ops.map(item => materialText(item, depth + 1)).join('');
    if (Array.isArray(value.content)) {
        const inline = value.content.every(item => item?.type === 'text' || item?.type === 'hardBreak');
        return value.content.map(item => item?.type === 'hardBreak' ? '\n' : materialText(item, depth + 1)).join(inline ? '' : '\n');
    }
    // Preserve arbitrary structured lesson payloads instead of losing sections
    // whose keys are not part of a particular rich-text editor schema.
    return Object.entries(value)
        .filter(([key]) => !['id', 'type', 'attrs', 'marks', 'version', 'image_base64', 'imageBase64'].includes(key))
        .map(([key, item]) => {
            const content = materialText(item, depth + 1);
            return content ? `${key}: ${content}` : '';
        }).filter(Boolean).join('\n');
}

function authenticationError(error) {
    return [401, 403].includes(Number(error?.statusCode || error?.status));
}

function transientError(error) {
    const status = Number(error?.statusCode || error?.status);
    return [408, 429, 502, 503, 504].includes(status) || status >= 500 ||
        ['TimeoutError', 'AbortError'].includes(error?.name) || error instanceof TypeError ||
        /^(ECONN|ENET|EHOST|ETIMEDOUT|EAI_AGAIN)/.test(error?.code || '');
}

function authExpired(error) {
    return Object.assign(new Error('Phiên EDUX đã hết hạn. Vui lòng kết nối lại EDUX.'), {
        statusCode: 401, status: 401, code: 'EDUX_SESSION_EXPIRED', sourceStatus: Number(error?.statusCode || error?.status) || 401,
    });
}

async function collectCourseMaterials(cookie, options = {}) {
    const { scope, subjectId } = options;
    if (!scope?.resolved) {
        return { courses: [], failures: [{ message: scope?.message || 'Chưa xác định được các môn đang học từ lịch học.' }], complete: false };
    }
    if (!scope.courses?.length) return { courses: [], failures: [], complete: true };
    if (!cookie) throw authExpired();
    const edux = options.edux || require('../../CRWEB/modules/EDUX');
    const { matchCourse } = require('./current-courses');
    const concurrency = Math.max(1, Math.min(6, Math.floor(Number(options.concurrency) || DEFAULT_CONCURRENCY)));
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? 250));
    const config = { cookie, strict: true, timeoutMs, retry: false, includeImages: true };
    const failures = [];
    let cancelled = false;

    async function read(operation) {
        for (let attempt = 0; ; attempt++) {
            if (cancelled) throw authExpired();
            try { return await operation(); }
            catch (error) {
                if (authenticationError(error)) { cancelled = true; throw authExpired(error); }
                if (!transientError(error) || attempt >= 2) throw error;
                if (retryDelayMs) await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** attempt));
            }
        }
    }

    function failure(error, details = {}) {
        const status = Number(error?.statusCode || error?.status) || null;
        const message = status ? `Không đọc được học liệu EDUX (HTTP ${status}).` :
            ['TimeoutError', 'AbortError'].includes(error?.name) ? 'EDUX không phản hồi kịp khi tải học liệu.' :
                error?.code === 'EMPTY_MATERIAL' ? 'Slide chưa có nội dung đọc được.' : 'Không đọc được học liệu EDUX. Vui lòng thử đồng bộ lại.';
        const entry = { ...details, stage: details.documentId ? 'content' : details.chapterId ? 'slides' : 'chapters',
            code: error?.code || (status ? `EDUX_HTTP_${status}` : 'EDUX_MATERIAL_READ'), status, message };
        failures.push(entry);
        return message;
    }

    const allSubjects = await read(() => edux.layHocPhan(config));
    if (!Array.isArray(allSubjects)) throw Object.assign(new Error('EDUX không trả danh sách môn học hợp lệ.'), { statusCode: 502 });
    const selected = allSubjects.filter(subject => matchCourse(scope, subject) &&
        (subjectId == null || text(subject.id) === text(subjectId)));
    if (subjectId != null && !selected.length) {
        throw Object.assign(new Error('Môn học không thuộc học kỳ hiện tại hoặc chưa được cấp trên EDUX.'), { statusCode: 404 });
    }
    if (subjectId == null) {
        for (const course of scope.courses) {
            if (!selected.some(subject => matchCourse({ ...scope, courses: [course] }, subject))) {
                failures.push({ subject: course.subjectName, subjectCode: course.subjectCode, stage: 'course', code: 'EDUX_COURSE_UNAVAILABLE',
                    message: 'Môn đang học chưa có học liệu được cấp trên EDUX.' });
            }
        }
    }
    const courses = [];
    for (const subject of selected) {
        const course = { id: text(subject.id), subject: text(subject.name), subjectCode: text(subject.subject_code), chapters: [], complete: true };
        courses.push(course);
        let models;
        try {
            models = await read(() => edux.layChuongTrinhHoc(subject.id, config));
            if (!Array.isArray(models)) throw Object.assign(new Error('Danh sách chương không hợp lệ.'), { status: 502 });
        } catch (error) {
            if (authenticationError(error)) throw error;
            course.complete = false;
            course.error = failure(error, { courseId: course.id, subject: course.subject });
            continue;
        }

        const work = [];
        for (const model of models) {
            const chapter = { id: text(model.id), title: text(model.title || model.name) || 'Chương học', documents: [], complete: true };
            course.chapters.push(chapter);
            try {
                const slides = await read(() => edux.laySlide(model.id, config));
                if (!Array.isArray(slides)) throw Object.assign(new Error('Danh sách slide không hợp lệ.'), { status: 502 });
                chapter.documents = slides.map(slide => ({
                    id: text(slide.id ?? slide.document_id), title: text(slide.title || slide.name) || 'Slide bài giảng',
                    number: slide.document_number ?? slide.number ?? null, content: '', status: 'error', error: null,
                }));
                for (const document of chapter.documents) work.push({ chapter, document });
            } catch (error) {
                if (authenticationError(error)) throw error;
                course.complete = chapter.complete = false;
                chapter.error = failure(error, { courseId: course.id, subject: course.subject, chapterId: chapter.id, chapter: chapter.title });
            }
        }

        let next = 0;
        await Promise.all(Array.from({ length: Math.min(concurrency, work.length) }, async () => {
            while (next < work.length && !cancelled) {
                const { chapter, document } = work[next++];
                try {
                    if (!document.id) throw Object.assign(new Error('Slide thiếu mã tài liệu.'), { status: 502 });
                    const payload = await read(() => edux.layNoiDungSlide(document.id, config));
                    const cached = await cacheSlideImages(payload, options.imageCache);
                    const raw = cached.content && typeof cached.content === 'object' && Object.hasOwn(cached.content, 'content')
                        ? cached.content.content : cached.content;
                    document.images = cached.images;
                    document.content = materialText(raw).trim();
                    if (!document.content && !document.images.length) throw Object.assign(new Error('Slide chưa có nội dung.'), { code: 'EMPTY_MATERIAL' });
                    document.rawContent = typeof raw === 'string' ? raw : JSON.stringify(raw) || '';
                    document.status = 'ready';
                } catch (error) {
                    if (authenticationError(error)) throw error;
                    course.complete = chapter.complete = false;
                    document.error = failure(error, { courseId: course.id, subject: course.subject, chapterId: chapter.id, chapter: chapter.title, documentId: document.id, document: document.title });
                }
            }
        }));
    }
    return { courses, failures, complete: failures.length === 0 && courses.every(course => course.complete) };
}

module.exports = { collectCourseMaterials, materialText };

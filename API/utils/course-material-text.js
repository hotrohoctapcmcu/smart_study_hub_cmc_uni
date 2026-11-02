'use strict';

const { createHash } = require('node:crypto');
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const documentsOf = chapters => chapters.flatMap(chapter => chapter.documents || []);

// Extend the supplied single-chapter tool to the entire course. Preserve the
// complete original content and source order; chapter headings keep slide
// numbers that restart at 1 in different chapters unambiguous.
function aggregateCourseText(course) {
    let index = 0;
    const chapters = (course.chapters || []).map(chapter => {
        const documents = (chapter.documents || []).filter(document => document.status === 'ready' || document.cached);
        if (!documents.length) return '';
        const content = documents.map(document => {
            const raw = document.rawContent ?? document.content ?? '';
            const text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw, null, 2);
            return `[${++index}] ${document.title || 'Không có tiêu đề'}\nID: ${document.id} | Số: ${document.number ?? ''}\n\n${text}`;
        }).join('\n\n');
        return `=== ${chapter.title || 'Chương học'} ===\n\n${content}`;
    }).filter(Boolean);
    return [`MÔN HỌC: ${course.subject || course.subject_name || ''}`, ...chapters].join('\n\n');
}

module.exports = { aggregateCourseText, fingerprint, documentsOf };

'use strict';

const { loi: fail } = require('../utils/error');

async function exportNotes(allNotes, id, notebook = false) {
    const notes = allNotes.filter(note => notebook ? String(note.notebookId) === id : note.id === id || String(note.databaseId) === id);
    if (!notes.length) throw fail('Chưa có ghi chú để xuất.', 404);
    const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
    const children = notes.flatMap(note => [new Paragraph({ text: note.title, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: [note.subject, note.chapter, note.tags.join(', ')].filter(Boolean).join(' · ') }),
        ...note.content.split(/\r?\n/).map(line => new Paragraph({ text: line }))]);
    return Packer.toBuffer(new Document({ creator: 'UniStudy CMC', sections: [{ children }] }));
}

module.exports = { exportNotes };

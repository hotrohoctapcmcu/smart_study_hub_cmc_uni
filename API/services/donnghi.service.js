'use strict';

const { randomUUID } = require('node:crypto');
const { clean, required, date } = require('../validators/hoctapai.validator');
const now = () => new Date().toISOString();

function createDonNghiService({ q, one }) {
    async function leaveDrafts() {
        return (await q('SELECT * FROM AiLeaveDrafts WHERE user_id=@uid ORDER BY updated_at DESC LIMIT 100'))
            .map(row => ({ id: row.draft_id, fields: JSON.parse(row.fields_json), content: row.content, updatedAt: row.updated_at }));
    }
    async function saveLeave(id, body = {}) {
        const content = required(body.content, 'Nội dung đơn', 20000);
        const input = body.fields || {};
        const fields = { date: date(input.date), reason: required(input.reason, 'Lý do', 1000),
            subject: clean(input.subject, 120), session: clean(input.session, 120), recipient: clean(input.recipient, 180) };
        if (id) await one('SELECT draft_id FROM AiLeaveDrafts WHERE user_id=@uid AND draft_id=@id', { id });
        const draftId = id || randomUUID();
        await q(`INSERT INTO AiLeaveDrafts(draft_id,user_id,fields_json,content,created_at,updated_at) VALUES(@id,@uid,@fields,@content,@created,@updated)
            ON CONFLICT(draft_id) DO UPDATE SET fields_json=excluded.fields_json,content=excluded.content,updated_at=excluded.updated_at WHERE user_id=@uid`,
            { id: draftId, fields: JSON.stringify(fields), content, created: now(), updated: now() });
        return { id: draftId, fields, content };
    }
    async function exportLeave(id) {
        const row = await one('SELECT content FROM AiLeaveDrafts WHERE user_id=@uid AND draft_id=@id', { id });
        const { Document, Packer, Paragraph, TextRun } = require('docx');
        return Packer.toBuffer(new Document({ sections: [{ children: row.content.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun({ text: line, font: 'Times New Roman', size: 26 })] })) }] }));
    }
    return { leaveDrafts, saveLeave, exportLeave };
}

module.exports = { createDonNghiService };

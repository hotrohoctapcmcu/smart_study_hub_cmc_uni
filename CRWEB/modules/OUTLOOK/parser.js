'use strict';

function htmlToText(value) {
    return String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>|<\/(?:p|div|li|tr)>/gi, '\n').replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

function normalizeMessage(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let id = raw.id || raw.Id || raw.ItemId;
    if (id && typeof id === 'object') id = id.Id || id.id;
    if (!id || (!Object.hasOwn(raw, 'subject') && !Object.hasOwn(raw, 'Subject'))) return null;
    const from = raw.from || raw.From || raw.sender || raw.Sender || {};
    const sender = from.emailAddress || from.EmailAddress || from.Mailbox || from;
    const body = raw.body || raw.Body || {};
    const content = typeof body === 'string' ? body : body.content || body.Content || body.Value || '';
    return {
        id: String(id), subject: raw.subject || raw.Subject || '(Không tiêu đề)',
        sender: sender.address || sender.Address || sender.EmailAddress || '', senderName: sender.name || sender.Name || '',
        date: raw.receivedDateTime || raw.DateTimeReceived || raw.ReceivedDateTime || '', isRead: Boolean(raw.isRead ?? raw.IsRead),
        preview: raw.bodyPreview || raw.Preview || '', body: htmlToText(content),
        webLink: raw.webLink || '', limited: !content
    };
}

function findMessages(root) {
    const found = new Map();
    function visit(node, depth) {
        if (!node || typeof node !== 'object' || depth > 20) return;
        const mail = normalizeMessage(node);
        if (mail && (!found.has(mail.id) || mail.body)) found.set(mail.id, mail);
        for (const value of Object.values(node)) visit(value, depth + 1);
    }
    visit(root, 0);
    return [...found.values()];
}

function hasEmptyMailbox(root, depth = 0) {
    if (!root || typeof root !== 'object' || depth > 20) return false;
    if (root.RootFolder?.TotalItemsInView === 0) return true;
    return Object.values(root).some(value => hasEmptyMailbox(value, depth + 1));
}

module.exports = { htmlToText, normalizeMessage, findMessages, hasEmptyMailbox };

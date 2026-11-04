'use strict';

const imageFields = new Set(['image', 'images', 'imagebase64', 'imageurl', 'imageurls', 'imagedata',
    'thumbnail', 'thumbnails', 'thumbnailurl', 'thumbnailbase64', 'coverimage', 'coverurl']);
const imageOnlyMessage = 'Slide chưa có nội dung văn bản. Ảnh EDUX không được lưu.';

// EDUX images are transient crawler data. Apply this before persisting source
// payloads, including images embedded in HTML, Markdown and editor JSON.
function withoutEduxImages(value, depth = 0) {
    if (depth > 40) return undefined;
    if (typeof value === 'string') {
        const input = value.trim();
        if (/^[\[{]/.test(input)) {
            try {
                const parsed = JSON.parse(input);
                const cleaned = withoutEduxImages(parsed, depth + 1);
                return JSON.stringify(cleaned) === JSON.stringify(parsed) ? value : JSON.stringify(cleaned) || '';
            } catch { /* HTML or plain lesson text */ }
        }
        if (/^(?:iVBORw0KGgo|\/9j\/|R0lGOD[dl]|UklGR)[a-z\d+/=\s]+$/i.test(input) ||
            /^(?:https?:\/\/|\/)[^\s]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^\s]*)?$/i.test(input)) return '';
        return value
            .replace(/<(picture|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
            .replace(/<img\b[^>]*>/gi, '')
            .replace(/!\[[^\]]*\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '')
            .replace(/data:image\/[^;,\s]+(?:;[^,\s]*)?,[^\s"'<>)]*/gi, '');
    }
    if (Array.isArray(value)) return value.map(item => withoutEduxImages(item, depth + 1)).filter(item => item !== undefined);
    if (!value || typeof value !== 'object') return value;
    if (/^(?:image|inlineImage|picture|img)$/i.test(value.type || '')) return undefined;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !imageFields.has(key.replace(/[_-]/g, '').toLowerCase()))
        .map(([key, item]) => [key, withoutEduxImages(item, depth + 1)])
        .filter(([, item]) => item !== undefined));
}

function textOnlyChapters(chapters) {
    const cleaned = withoutEduxImages(chapters);
    if (!Array.isArray(cleaned)) return [];
    for (const chapter of cleaned) {
        for (const document of chapter.documents || []) {
            if (document.status === 'ready' && !String(document.content || document.rawContent || '').trim()) {
                document.status = 'error';
                document.error = imageOnlyMessage;
                chapter.complete = false;
            }
        }
    }
    return cleaned;
}

module.exports = { withoutEduxImages, textOnlyChapters };

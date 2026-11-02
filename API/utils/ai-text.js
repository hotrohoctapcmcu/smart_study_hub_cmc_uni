'use strict';

const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
const characterCount = value => Array.from(value).length;
const hasVisibleText = value => typeof value === 'string' && value.replace(/\p{Default_Ignorable_Code_Point}/gu, '').trim().length > 0;

// Keep accents, ZWJ emoji, indentation and Markdown/code intact. Literal
// backslash sequences in code are not transport escapes.
function normalizeText(value) {
    const text = String(value ?? '');
    return text.toWellFormed().replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function sliceText(value, maxCharacters) {
    let count = 0, end = 0;
    for (const part of segmenter.segment(value)) {
        count += characterCount(part.segment);
        if (count > maxCharacters) break;
        end = part.index + part.segment.length;
    }
    return value.slice(0, end);
}

function safeBoundary(value, target) {
    for (const part of segmenter.segment(value)) {
        const end = part.index + part.segment.length;
        if (end >= target) return end;
    }
    return value.length;
}

module.exports = { normalizeText, characterCount, sliceText, safeBoundary, hasVisibleText };

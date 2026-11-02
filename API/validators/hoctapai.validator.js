'use strict';

const context = require('../utils/study-context');
const { normalizeText, characterCount, sliceText, hasVisibleText } = require('../utils/ai-text');

const fail = (message, statusCode = 400, code = 'AI_INPUT') => Object.assign(new Error(message), { statusCode, code });
const clean = (value, max = 500) => typeof value === 'string' ? sliceText(normalizeText(value).trim(), max) : '';
function required(value, label, max = 500) {
    if (typeof value !== 'string') throw fail(`${label} là bắt buộc.`);
    const text = normalizeText(value).trim();
    if (!hasVisibleText(text)) throw fail(`${label} là bắt buộc.`);
    if (characterCount(text) > max) throw fail(`${label} tối đa ${max} ký tự.`, 413, 'AI_INPUT_SIZE');
    return text;
}
function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || context.normalizeDate(value) !== value) throw fail('Ngày phải hợp lệ và có dạng YYYY-MM-DD.');
    return value;
}

module.exports = { fail, clean, required, date };

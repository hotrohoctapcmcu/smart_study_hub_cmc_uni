'use strict';

// The web provider can return an error message inside an HTTP 200 response.
// Match whole service messages so study content about errors remains valid.
function responseFailure(value) {
    if (typeof value !== 'string' || value.length > 1000) return null;
    const text = value.trim().replace(/\s+/g, ' ');
    if (/^(?:sorry[,!.]?\s*)?something went wrong[.!]?(?:\s*please try(?: your request)? again(?: later)?[.!]?)?$/i.test(text) ||
        /^(?:rất tiếc[,!.]?\s*)?đã xảy ra lỗi[.!]?(?:\s*vui lòng thử lại(?: sau)?[.!]?)?$/iu.test(text)) {
        return { code: 'GEMINI_RESPONSE_ERROR', statusCode: 502,
            message: 'AI trả thông báo lỗi thay vì nội dung. Vui lòng thử lại.' };
    }
    if (/^(?:(?:your|the)\s+)?(?:prompt|message|input|request)\s+(?:is\s+)?too (?:long|large)(?:[.!]|$)/i.test(text)) {
        return { code: 'GEMINI_INPUT_SIZE', statusCode: 413,
            message: 'Nội dung vượt giới hạn đầu vào hiện tại của AI.' };
    }
    return null;
}

module.exports = { responseFailure };

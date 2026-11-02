"use strict";

const { GeminiError } = require("./gemini-error");

function parseJson(text) {
    const raw = String(text || "").trim();
    const candidates = [raw];
    const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match => match[1].trim());
    candidates.push(...fenced);

    // Balanced extraction respects brackets and escaped quotes inside strings.
    // Never rewrite escape sequences or repair quotes in educational/code data.
    let start = -1, quoted = false, escaped = false, stack = [];
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (start < 0) { if (c === '{' || c === '[') { start = i; stack = [c]; } continue; }
        if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
        if (c === '"') quoted = true;
        else if (c === '{' || c === '[') stack.push(c);
        else if (c === '}' || c === ']') {
            if (stack.pop() !== (c === '}' ? '{' : '[')) { start = -1; stack = []; continue; }
            if (!stack.length) { candidates.push(raw.slice(start, i + 1)); start = -1; }
        }
    }

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch { /* thử ứng viên tiếp theo */ }
    }
    throw new GeminiError("AI trả JSON không hợp lệ.", "GEMINI_JSON", 502);
}

module.exports = { parseJson };

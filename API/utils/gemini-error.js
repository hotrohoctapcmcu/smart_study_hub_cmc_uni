"use strict";

class GeminiError extends Error {
    constructor(message, code = "GEMINI_ERROR", statusCode = 502) {
        super(message);
        this.name = "GeminiError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

module.exports = { GeminiError };

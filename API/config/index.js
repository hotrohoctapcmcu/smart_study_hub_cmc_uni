/**
 * API/config/index.js
 * ===================================================================================
 * CẤU HÌNH TẬP TRUNG — BACKEND API SERVER
 * ===================================================================================
 * Mọi hằng số dùng chung của API (port, prefix, CORS, ...) nằm ở một nơi duy
 * nhất để API/index.js và các module cùng đọc, tránh rải rác magic-string.
 * Giữ nguyên giá trị đang chạy (PORT 3001, prefix /api/v1, ...) — chỉ di dời chỗ
 * khai báo, không đổi hành vi.
 * ===================================================================================
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const API_PREFIX = '/api/v1';
const PORT = process.env.API_PORT || 3001;

const CORS_OPTIONS = {
    origin: true,
    credentials: true
};

const JSON_LIMIT = '10mb';

const FRONTEND_URL = 'http://localhost:8080';

const SERVICE = {
    name: 'UniStudy CMC — API Sprint 1',
    version: '1.0.0'
};

module.exports = {
    API_PREFIX,
    PORT,
    CORS_OPTIONS,
    JSON_LIMIT,
    FRONTEND_URL,
    SERVICE
};

/**
 * UniStudy CMC - API Client
 * Ranh giới xử lý Fetch, HTTP error, timeout và cancellation.
 * Khi chưa cấu hình API_BASE_URL: không gửi request, trả về trạng thái UNCONNECTED/UNAVAILABLE.
 */
import { APP_CONFIG } from "../config/app.config.js";
import { logger } from "../utils/logger.js";

export class ApiError extends Error {
  constructor(message, status = 0, code = "API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Gửi HTTP request hoặc trả trạng thái chưa kết nối
 * @param {object} endpointDef - { method: string, path: string }
 * @param {object} [options] - { params, body, headers, signal }
 * @returns {Promise<{success: boolean, data?: any, error?: string, unavailable: boolean}>}
 */
export async function apiRequest(endpointDef, options = {}) {
  if (!APP_CONFIG.apiBaseUrl || !APP_CONFIG.isApiConnected) {
    logger.debug(`API endpoint ${endpointDef.method} ${endpointDef.path} chưa có kết nối server.`);
    return {
      success: false,
      unavailable: true,
      error: "Hệ thống backend chưa được kết nối. Dữ liệu đang hoạt động ở chế độ bộ nhớ cục bộ.",
      data: null
    };
  }

  // Khung Fetch chuẩn khi có cấu hình backend
  let timeoutId = null;
  try {
    let url = `${APP_CONFIG.apiBaseUrl}${endpointDef.path}`;
    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        url = url.replace(`:${key}`, encodeURIComponent(options.params[key]));
      });
    }

    const controller = options.signal ? null : new AbortController();
    if (!controller) {
      timeoutId = setTimeout(() => controller.abort(), 20000);
    }
    const fetchOptions = {
      method: endpointDef.method,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: options.signal || (controller ? controller.signal : undefined)
    };

    if (options.body && endpointDef.method !== "GET") {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new ApiError(`Lỗi kết nối máy chủ: ${response.statusText}`, response.status);
    }
    const data = await response.json();
    return { success: true, unavailable: false, data };
  } catch (err) {
    logger.error("API Request Error:", err.message);
    return {
      success: false,
      unavailable: false,
      error: err.message,
      data: null
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

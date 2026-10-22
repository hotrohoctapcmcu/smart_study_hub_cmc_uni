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
 * @param {object} [options] - { params, body, headers, signal, timeout, silent }
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
    const queryParams = new URLSearchParams();

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        if (url.includes(`:${key}`)) {
          url = url.replace(`:${key}`, encodeURIComponent(options.params[key]));
        } else if (options.params[key] !== null && options.params[key] !== undefined && options.params[key] !== "") {
          queryParams.append(key, options.params[key]);
        }
      });
    }

    if (options.queryParams) {
      Object.keys(options.queryParams).forEach((key) => {
        if (options.queryParams[key] !== null && options.queryParams[key] !== undefined && options.queryParams[key] !== "") {
          queryParams.append(key, options.queryParams[key]);
        }
      });
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }

    // Timeout chỉ áp cho request không do bên gọi tự huỷ (options.signal).
    // Trước đây điều kiện bị đảo: có signal thì lại tạo timeout gọi abort()
    // trên controller null, còn không có signal thì không có timeout nào.
    const controller = options.signal ? null : new AbortController();
    if (controller) {
      timeoutId = setTimeout(
        () => controller.abort(),
        Number(options.timeout) > 0 ? Number(options.timeout) : 20000
      );
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
      // Đọc body lỗi để giữ thông báo nghiệp vụ của server (vd "Phiên EDUX đã hết hạn").
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      const message = (body && (body.message || body.error)) || response.statusText;
      throw new ApiError(message, response.status, "API_ERROR", body);
    }
    const data = await response.json();
    return { success: true, unavailable: false, data };
  } catch (err) {
    // silent: lỗi đã được bên gọi coi là bình thường (vd 401 khi chưa đồng bộ
    // EDUX lần nào) — không ghi ERROR làm nhiễu console.
    if (!options.silent) logger.error("API Request Error:", err.message);
    return {
      success: false,
      unavailable: false,
      error: err.message,
      status: err.status || 0,
      data: null
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

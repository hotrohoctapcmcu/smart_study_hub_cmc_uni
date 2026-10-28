import { apiRequest } from "./api-client.js";
import { APP_CONFIG } from "../config/app.config.js";

export async function workspaceRequest(method, path, options = {}) {
  const response = await apiRequest({ method, path: `/api/v1${path}` }, options);
  if (!response.success) throw new Error(response.error || "Không thể lưu dữ liệu. Vui lòng thử lại.");
  return response.data?.data;
}

export function workspaceFileUrl(path) {
  return `${APP_CONFIG.apiBaseUrl}/api/v1${path}`;
}

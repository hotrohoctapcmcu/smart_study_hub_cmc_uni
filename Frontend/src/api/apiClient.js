import axios from "axios";

const API_URL = globalThis.__SSH_RUNTIME__?.apiBaseUrl || import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (
    config.url?.startsWith("/ai/") ||
    config.url?.includes("/pull") ||
    config.url === "/email/sync"
  )
    config.timeout = 180000;
  return config;
});

apiClient.interceptors.response.use((response) => {
  if (response.data?.success === false) {
    const error = new Error(response.data.message || "Yêu cầu không thành công.");
    error.response = response;
    error.code = response.data.error?.code;
    return Promise.reject(error);
  }
  return response;
});
if (import.meta.env.VITE_USE_MOCK === "true") {
  apiClient.defaults.adapter = async (config) =>
    (await import("../test/mockAdapter.js")).mockAdapter(config);
}

export function unwrapResponse(response) {
  const payload = response?.config ? response.data : response;
  return payload && Object.prototype.hasOwnProperty.call(payload, "data")
    ? payload.data
    : payload ?? null;
}
export function responseList(value, key) {
  const data = unwrapResponse(value);
  if (Array.isArray(data)) return data;
  return key && Array.isArray(data?.[key]) ? data[key] : [];
}
export const backendOrigin = new URL(API_URL, window.location.origin).origin;

export default apiClient;

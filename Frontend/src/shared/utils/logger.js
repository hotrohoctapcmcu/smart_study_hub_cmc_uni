/**
 * UniStudy CMC - Logger Utility
 * Đảm bảo không log thông tin nhạy cảm, token, mật khẩu
 */
const PREFIX = "[UniStudy]";

export const logger = {
  info: (message, ...args) => {
    console.info(`${PREFIX} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`${PREFIX} [WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`${PREFIX} [ERROR] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    // Có thể bật khi cần debug
  }
};

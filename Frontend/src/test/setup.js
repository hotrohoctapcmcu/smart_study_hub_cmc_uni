import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
vi.stubEnv("VITE_USE_MOCK", "true");
window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserver;
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
afterEach(() => cleanup());

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import apiClient from "../api/apiClient";
import { syncApi } from "../api";
import { AppProvider } from "../components/common/ui";
import Sync from "../pages/Sync/Sync";
import { formatDateTime } from "../utils/date";

const originalAdapter = apiClient.defaults.adapter;
let requests, connected;
const keys = ["iu", "edux", "outlook"];
function completed(sources = ["IU", "EDUX", "OUTLOOK"], results) {
  return { jobId: "job-all", status: "COMPLETED", ok: true, sources, progress: { completed: sources.length, total: sources.length, percent: 100 }, results: results || Object.fromEntries(sources.map(key => [key.toLowerCase(), { ok: true, status: "COMPLETED", synced: true }])) };
}
function response(config, data) {
  return { data: { success: true, data }, status: 200, statusText: "OK", headers: {}, config };
}
beforeEach(() => {
  connected = { iu: true, edux: true, outlook: true };
  requests = vi.fn(async config => {
    if (config.url === "/sync/sources") return response(config, { sources: [] });
    if (config.url === "/sync/current-courses") return response(config, { courses: [] });
    if (config.url === "/sync/status") return response(config, { status: "IDLE", results: {} });
    if (config.url.endsWith("/status")) {
      const key = config.url.startsWith("/email") ? "outlook" : config.url.split("/")[2];
      return response(config, { connected: connected[key] });
    }
    if (config.url === "/sync") return response(config, completed(JSON.parse(config.data).sources));
    return response(config, {});
  });
  apiClient.defaults.adapter = requests;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  delete window.__uniStudySync;
  delete window.__uniStudyIU;
  delete window.__uniStudyOutlook;
});
const calls = url => requests.mock.calls.filter(([config]) => config.url === url);
function mount() { render(<MemoryRouter><AppProvider><Sync /></AppProvider></MemoryRouter>); }

describe("Connection progress and deadlines", () => {
  it("normalizes invalid and excessive native deadlines without overflowing timers", async () => {
    const connectAll = vi.fn().mockResolvedValue({ ok: true, results: {} });
    window.__uniStudySync = { connectAll };
    const timers = vi.spyOn(globalThis, "setTimeout");
    try {
      for (const value of [Infinity, -1, Number.MAX_SAFE_INTEGER]) {
        await syncApi.connectAll({ iu: { timeoutMs: value }, edux: { timeoutMs: value }, outlook: { timeoutMs: value }, connectionTimeoutMs: value });
      }
      expect(connectAll.mock.calls.every(([auth]) => auth.iu.timeoutMs === 180000 && auth.outlook.timeoutMs === 180000 && auth.edux.timeoutMs === 45000)).toBe(true);
      expect(timers.mock.calls.every(([, duration]) => duration === 195000)).toBe(true);
    } finally { timers.mockRestore(); }
  });

  it("publishes connected sources while another browser session check is pending", async () => {
    const adapter = apiClient.defaults.adapter;
    let finishIu;
    apiClient.defaults.adapter = config => config.url === "/sync/iu/status"
      ? new Promise(resolve => { finishIu = () => resolve(response(config, { connected: true })); })
      : adapter(config);
    const updates = [];
    const pending = syncApi.connectAll({ onConnectionProgress: snapshot => updates.push(snapshot) });
    await waitFor(() => expect(updates.some(snapshot => snapshot.results.edux.connected && snapshot.results.outlook.connected)).toBe(true));
    expect(updates.at(-1).results.iu.status).toBe("CHECKING");
    finishIu();
    expect((await pending).ok).toBe(true);
  });

  it("forwards Electron connection progress before login finishes and unsubscribes", async () => {
    let listener, finish;
    const unsubscribe = vi.fn();
    window.__uniStudySync = {
      onConnectionProgress: callback => { listener = callback; return unsubscribe; },
      connectAll: vi.fn(() => new Promise(resolve => { finish = resolve; })),
    };
    const onProgress = vi.fn();
    const pending = syncApi.all({ onProgress });
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    listener({ results: { edux: { status: "CONNECTED", ok: true, connected: true } } });
    expect(onProgress.mock.calls.at(-1)[0].results.edux.status).toBe("CONNECTED");
    expect(calls("/sync")).toHaveLength(0);
    finish({ ok: true, results: Object.fromEntries(keys.map(key => [key, { ok: true }])) });
    expect((await pending).ok).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("bounds a stalled Electron invocation and preserves confirmed connected sources", async () => {
    let listener;
    const unsubscribe = vi.fn();
    window.__uniStudySync = {
      onConnectionProgress: callback => { listener = callback; return unsubscribe; },
      connectAll: vi.fn(() => {
        listener({ results: { edux: { status: "CONNECTED", connected: true, ok: true } } });
        return new Promise(() => {});
      }),
    };
    const result = await syncApi.all({ connectionTimeoutMs: 5 });
    expect(result.status).toBe("PARTIAL");
    expect(result.results.edux.ok).toBe(true);
    expect(result.results.iu.status).toBe("FAILED");
    expect(JSON.parse(calls("/sync")[0][0].data).sources).toEqual(["EDUX"]);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("One action connects and syncs three portals", () => {
  it("reuses sessions and sends one real sync request for all three without placeholder jobs", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByText("IU: Đã đồng bộ");
    expect(calls("/sync")).toHaveLength(1);
    expect(JSON.parse(calls("/sync")[0][0].data)).toEqual({ sources: ["IU", "EDUX", "OUTLOOK"] });
    expect(calls("/sync/all")).toHaveLength(0);
    expect(calls("/sync/status")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("collects EDUX credentials once and invokes the unified login before syncing", async () => {
    connected = { iu: false, edux: false, outlook: false };
    const connectAll = vi.fn(async options => {
      expect(options).toEqual({ edux: { email: "student@cmcu.edu.vn", password: "one-use-password" } });
      expect(calls("/sync")).toHaveLength(0);
      connected = { iu: true, edux: true, outlook: true };
      return { ok: true, results: { iu: { ok: true }, edux: { ok: true }, outlook: { ok: true } } };
    });
    window.__uniStudySync = { connectAll };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByRole("dialog", { name: "Kết nối & đồng bộ cả 3" });
    fireEvent.change(screen.getByLabelText("Email EDUX"), { target: { value: "student@cmcu.edu.vn" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu EDUX"), { target: { value: "one-use-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Kết nối & đồng bộ" }));
    await screen.findByText("Outlook: Đã đồng bộ");
    expect(connectAll).toHaveBeenCalledOnce();
    expect(calls("/sync")).toHaveLength(1);
    expect(screen.queryByLabelText("Mật khẩu EDUX")).toBeNull();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("one-use-password");
  });

  it("keeps successful portals syncing when Microsoft login is canceled for another portal", async () => {
    window.__uniStudySync = { connectAll: vi.fn().mockResolvedValue({
      ok: false,
      results: { iu: { ok: false, message: "Đã hủy đăng nhập IU" }, edux: { ok: true }, outlook: { ok: true } },
    }) };
    const result = await syncApi.all();
    expect(result.ok).toBe(false);
    expect(result.results.iu.message).toBe("Đã hủy đăng nhập IU");
    expect(result.results.edux.ok).toBe(true);
    expect(result.results.outlook.ok).toBe(true);
    expect(result.status).toBe("PARTIAL");
    expect(result.backendStatus).toBe("COMPLETED");
    expect(JSON.parse(calls("/sync")[0][0].data).sources).toEqual(["EDUX", "OUTLOOK"]);
  });

  it("uses browser credentials and saved Outlook session without a Microsoft bridge", async () => {
    connected.edux = false;
    const result = await syncApi.all({ edux: { email: "test@cmcu.edu.vn", password: "temporary" } });
    expect(result.ok).toBe(true);
    expect(calls("/sync/edux/session")).toHaveLength(1);
    expect(calls("/sync")).toHaveLength(1);
  });

  it("continues other portals when an IU preflight status request fails", async () => {
    const adapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async config => {
      if (config.url === "/sync/iu/status") throw new Error("IU status unavailable");
      return adapter(config);
    };
    const connectAll = vi.fn().mockResolvedValue({
      ok: false,
      results: {
        iu: { ok: false, message: "IU status unavailable" },
        edux: { ok: true },
        outlook: { ok: true },
      },
    });
    window.__uniStudySync = { connectAll };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByText("Outlook: Đã đồng bộ");
    expect(connectAll).toHaveBeenCalledOnce();
    expect(JSON.parse(calls("/sync")[0][0].data).sources).toEqual(["EDUX", "OUTLOOK"]);
    expect(calls("/sync")[0][0].timeout).toBe(30000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows saved partial data as partially synced and reloads it without claiming full success", async () => {
    const adapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async config => {
      if (config.url === "/sync") return response(config, {
        jobId: "partial-all", status: "PARTIAL", ok: false,
        results: {
          iu: { ok: false, synced: true, partial: true, warningCount: 2, message: "Đã đồng bộ một phần IU; 2 nhóm dữ liệu chưa lấy được." },
          edux: { ok: true },
          outlook: { ok: true },
        },
      });
      return adapter(config);
    };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    expect(await screen.findByText("IU: Đã đồng bộ một phần — Đã đồng bộ một phần IU; 2 nhóm dữ liệu chưa lấy được.")).toBeTruthy();
    expect(screen.getByText("EDUX: Đã đồng bộ")).toBeTruthy();
    expect(screen.getByText("Outlook: Đã đồng bộ")).toBeTruthy();
    expect(screen.queryByText("IU: Đã đồng bộ")).toBeNull();
    await waitFor(() => expect(calls("/sync/current-courses").length).toBeGreaterThanOrEqual(2));
  });

  it("deduplicates concurrent calls and does not sync when every login fails", async () => {
    let finish;
    window.__uniStudySync = { connectAll: vi.fn(() => new Promise(resolve => { finish = resolve; })) };
    const first = syncApi.all(), second = syncApi.all();
    expect(first).toBe(second);
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    finish({ ok: false, results: { iu: { ok: false }, edux: { ok: false }, outlook: { ok: false } } });
    expect((await first).ok).toBe(false);
    expect(window.__uniStudySync.connectAll).toHaveBeenCalledOnce();
    expect(calls("/sync")).toHaveLength(0);
  });

  it("polls one real job through ordered source progress without passing callbacks to IPC", async () => {
    const connectAll = vi.fn(async options => {
      expect(options).toEqual({});
      return { ok: true, results: Object.fromEntries(keys.map(key => [key, { ok: true }])) };
    });
    window.__uniStudySync = { connectAll };
    let polls = 0;
    const onProgress = vi.fn();
    const pending = { jobId: "progress-job", status: "PENDING", results: Object.fromEntries(keys.map(key => [key, { status: "PENDING" }])), progress: { completed: 0, total: 3, percent: 0 } };
    apiClient.defaults.adapter = async config => {
      if (config.url === "/sync") return response(config, pending);
      if (config.url === "/sync/status") {
        expect(config.params.jobId).toBe("progress-job");
        polls++;
        return response(config, polls === 1 ? { ...pending, status: "RUNNING", activeSource: "EDUX", progress: { completed: 1, total: 3, percent: 33 },
          results: { iu: { ok: true, status: "COMPLETED" }, edux: { status: "RUNNING" }, outlook: { status: "PENDING" } } }
          : { ...completed(), jobId: "progress-job" });
      }
      throw new Error("Unexpected request " + config.url);
    };
    const result = await syncApi.all({ onProgress, pollIntervalMs: 0 });
    expect(result.ok).toBe(true);
    expect(polls).toBe(2);
    expect(connectAll).toHaveBeenCalledOnce();
    expect(onProgress.mock.calls.map(([job]) => job.status)).toContain("PENDING");
    expect(onProgress.mock.calls.find(([job]) => job.activeSource === "EDUX")[0].results.iu.ok).toBe(true);
    expect(onProgress.mock.calls.at(-1)[0].progress.percent).toBe(100);
  });

  it("preserves confirmed source results when status polling loses the connection", async () => {
    const adapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async config => {
      if (config.url === "/sync") return response(config, { jobId: "lost-job", status: "RUNNING", results: {
        iu: { ok: true, synced: true, status: "COMPLETED" }, edux: { status: "RUNNING" }, outlook: { status: "PENDING" },
      } });
      if (config.url === "/sync/status") throw new Error("Mất kết nối theo dõi");
      return adapter(config);
    };
    const result = await syncApi.all({ pollIntervalMs: 0 });
    expect(result.ok).toBe(false);
    expect(result.jobId).toBe("lost-job");
    expect(result.monitoringError).toBe(true);
    expect(result.results.iu).toMatchObject({ ok: true, status: "COMPLETED" });
    expect(result.results.edux).toMatchObject({ ok: false, status: "UNKNOWN", monitoringLost: true });
    expect(result.results.outlook.status).toBe("UNKNOWN");
  });

  it("rejects an invalid start response without claiming any source completed", async () => {
    const adapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async config => config.url === "/sync" ? response(config, { status: "PENDING" }) : adapter(config);
    const result = await syncApi.all({ pollIntervalMs: 0 });
    expect(result.ok).toBe(false);
    expect(keys.every(key => result.results[key].ok === false)).toBe(true);
    expect(result.results.iu.message).toContain("hợp lệ");
    expect(calls("/sync/status")).toHaveLength(0);
  });

  it("resumes an existing running job after navigation without logging in or starting another sync", async () => {
    const adapter = apiClient.defaults.adapter;
    const pending = { jobId: "resumed-job", status: "RUNNING", activeSource: "IU", progress: { completed: 0, total: 3, percent: 0 },
      results: { iu: { status: "RUNNING", message: "Đang tải IU." }, edux: { status: "PENDING" }, outlook: { status: "PENDING" } } };
    apiClient.defaults.adapter = async config => config.url === "/sync/status"
      ? response(config, config.params?.jobId ? { ...completed(), jobId: "resumed-job" } : pending) : adapter(config);
    const connectAll = vi.fn();
    window.__uniStudySync = { connectAll };
    mount();
    expect(await screen.findByText("IU: Đang đồng bộ — Đang tải IU.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đồng bộ tất cả" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Ngắt IU" }).disabled).toBe(true);
    expect(screen.getByRole("progressbar", { name: "Tiến độ đồng bộ" }).value).toBe(0);
    await screen.findByText("IU: Đã đồng bộ");
    expect(connectAll).not.toHaveBeenCalled();
    expect(calls("/sync")).toHaveLength(0);
    expect(screen.getByRole("progressbar", { name: "Tiến độ đồng bộ" }).value).toBe(3);
    await waitFor(() => expect(calls("/sync/current-courses").length).toBeGreaterThanOrEqual(2));
  });

  it("ignores a delayed previous job response after a new all-source action completes", async () => {
    const adapter = apiClient.defaults.adapter;
    let finishPrevious;
    apiClient.defaults.adapter = async config => config.url === "/sync/status" && !config.params?.jobId
      ? new Promise(resolve => { finishPrevious = () => resolve(response(config, { jobId: "old-job", status: "RUNNING", results: { iu: { status: "RUNNING", message: "Old job" } } })); })
      : adapter(config);
    mount();
    await waitFor(() => expect(finishPrevious).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByText("IU: Đã đồng bộ");
    await act(async () => { finishPrevious(); });
    expect(screen.queryByText(/Old job/)).toBeNull();
    expect(screen.getByText("IU: Đã đồng bộ")).toBeTruthy();
    expect(calls("/sync")).toHaveLength(1);
  });

  it("displays each source's actual last sync time from the shared registry", async () => {
    const adapter = apiClient.defaults.adapter, timestamp = "2026-10-30T03:45:00.000Z";
    apiClient.defaults.adapter = async config => config.url === "/sync/sources"
      ? response(config, { sources: keys.map(key => ({ id: key.toUpperCase(), connected: true, lastSync: timestamp })) })
      : adapter(config);
    mount();
    expect(await screen.findAllByText("Lần đồng bộ cuối: " + formatDateTime(timestamp))).toHaveLength(3);
  });

  it("bounds status monitoring time without canceling or restarting the backend job", async () => {
    const running = { jobId: "long-job", status: "RUNNING", results: { iu: { status: "RUNNING" } } };
    apiClient.defaults.adapter = async config => response(config, running);
    await expect(syncApi.watch(running, { timeoutMs: 1, pollIntervalMs: 5 })).rejects.toMatchObject({ lastJob: running });
    expect(calls("/sync")).toHaveLength(0);
  });

  it("rejects unknown job states immediately and preserves the last confirmed success", async () => {
    const adapter = apiClient.defaults.adapter;
    const running = { jobId: "unexpected-state", status: "RUNNING", results: {
      iu: { ok: true, synced: true, status: "COMPLETED" }, edux: { status: "RUNNING" }, outlook: { status: "PENDING" },
    } };
    apiClient.defaults.adapter = async config => {
      if (config.url === "/sync") return response(config, running);
      if (config.url === "/sync/status") return response(config, { ...running, status: "IDLE" });
      return adapter(config);
    };
    const result = await syncApi.all({ pollIntervalMs: 0 });
    expect(result.status).toBe("UNKNOWN");
    expect(result.results.iu.ok).toBe(true);
    expect(result.results.edux.status).toBe("UNKNOWN");
    await expect(syncApi.watch({ ...running, status: "UNEXPECTED" })).rejects.toThrow("hợp lệ");
  });

  it("reports a unified login transport failure without leaving the page stuck connecting", async () => {
    window.__uniStudySync = { connectAll: vi.fn().mockRejectedValue(new Error("Không mở được đăng nhập chung")) };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByText("IU: Chưa đồng bộ — Không mở được đăng nhập chung");
    expect(calls("/sync")).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole("button", { name: "Đồng bộ tất cả" }).disabled).toBe(false));
  });
});

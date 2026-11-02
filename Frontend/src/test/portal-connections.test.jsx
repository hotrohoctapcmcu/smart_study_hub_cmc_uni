import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import apiClient from "../api/apiClient";
import { emailApi, syncApi } from "../api";
import { AppProvider } from "../components/common/ui";
import Sync from "../pages/Sync/Sync";

const originalAdapter = apiClient.defaults.adapter;
let requests;
let iuConnected;
let outlookConnected;

beforeEach(() => {
  iuConnected = false;
  outlookConnected = false;
  requests = vi.fn(async (config) => {
    let data = {};
    if (config.url === "/sync/sources") data = { sources: [{ id: "IU" }, { id: "EDUX" }] };
    if (config.url === "/sync/current-courses") data = { courses: [] };
    if (config.url === "/sync/iu/status") data = { connected: iuConnected };
    if (config.url === "/sync/edux/status") data = { connected: false };
    if (config.url === "/email/status") data = { connected: outlookConnected };
    return { data: { success: true, data }, status: 200, statusText: "OK", headers: {}, config };
  });
  apiClient.defaults.adapter = requests;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  delete window.__uniStudyIU;
  delete window.__uniStudyOutlook;
});

function mountSync() {
  render(<MemoryRouter><AppProvider><Sync /></AppProvider></MemoryRouter>);
}

async function iuCard() {
  return (await screen.findByRole("heading", { name: "IU" })).closest("article");
}

function called(method, url) {
  return requests.mock.calls.some(([config]) => config.method === method && config.url === url);
}

describe("Existing portal connections", () => {
  it("connects IU from the existing button through Electron and reloads its status", async () => {
    const loginIU = vi.fn(async () => { iuConnected = true; return { ok: true }; });
    window.__uniStudyIU = { isAvailable: true, loginIU };
    mountSync();
    fireEvent.click(within(await iuCard()).getByRole("button", { name: "Kết nối" }));
    await waitFor(() => expect(loginIU).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Ngắt IU" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(called("post", "/sync/iu/session")).toBe(false);
  });

  it("keeps the manual IU session dialog available in a regular browser", async () => {
    mountSync();
    fireEvent.click(within(await iuCard()).getByRole("button", { name: "Kết nối" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Dữ liệu phiên IU" })).toBeTruthy();
    expect(called("post", "/sync/iu/session")).toBe(false);
  });

  it("shows an IU login error without pretending the portal connected", async () => {
    window.__uniStudyIU = { isAvailable: true, loginIU: vi.fn().mockRejectedValue(new Error("Đã hủy đăng nhập IU")) };
    mountSync();
    fireEvent.click(within(await iuCard()).getByRole("button", { name: "Kết nối" }));
    expect(await screen.findByText("Đã hủy đăng nhập IU")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ngắt IU" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("disconnects IU through the existing logout bridge so the persisted login is cleared", async () => {
    const logoutIU = vi.fn().mockResolvedValue({ ok: true });
    window.__uniStudyIU = { isAvailable: true, logoutIU };
    await syncApi.iu.deleteSession();
    expect(logoutIU).toHaveBeenCalledOnce();
    expect(called("delete", "/sync/iu/session")).toBe(false);
  });

  it("uses the existing HTTP logout when no Electron IU bridge exists", async () => {
    await syncApi.iu.deleteSession();
    expect(called("delete", "/sync/iu/session")).toBe(true);
    expect(await syncApi.iu.connect()).toBe(false);
  });

  it("uses a 70-day IU exam horizon by default and preserves an explicit override without inventing timetable dates", async () => {
    await syncApi.iu.pull();
    await syncApi.iu.pull({ soNgayLichThi: 60 });
    const pulls = requests.mock.calls.filter(([config]) => config.method === "post" && config.url === "/sync/iu/pull");
    expect(pulls).toHaveLength(2);
    expect(JSON.parse(pulls[0][0].data)).toEqual({ soNgayLichThi: 70 });
    expect(JSON.parse(pulls[1][0].data)).toEqual({ soNgayLichThi: 60 });
  });

  it("connects Outlook before syncing email when Electron has no active session", async () => {
    const connect = vi.fn(async () => {
      expect(called("post", "/email/sync")).toBe(false);
      return { connected: true };
    });
    window.__uniStudyOutlook = { connect };
    await emailApi.sync();
    expect(connect).toHaveBeenCalledOnce();
    expect(called("get", "/email/status")).toBe(true);
    expect(called("post", "/email/sync")).toBe(true);
  });

  it("syncs email directly when Outlook is already connected", async () => {
    outlookConnected = true;
    const connect = vi.fn();
    window.__uniStudyOutlook = { connect };
    await emailApi.sync();
    expect(connect).not.toHaveBeenCalled();
    expect(called("post", "/email/sync")).toBe(true);
  });

  it("does not start an email sync when the Outlook login is canceled", async () => {
    window.__uniStudyOutlook = { connect: vi.fn().mockRejectedValue(new Error("Outlook login canceled")) };
    await expect(emailApi.sync()).rejects.toThrow("Outlook login canceled");
    expect(called("post", "/email/sync")).toBe(false);
  });
});

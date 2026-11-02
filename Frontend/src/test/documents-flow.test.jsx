import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Documents from "../pages/Documents/Documents";
import apiClient from "../api/apiClient";

const originalAdapter = apiClient.defaults.adapter;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
function envelope(config, data) {
  return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data } };
}
function Location() {
  const location = useLocation();
  return <output aria-label="Đường dẫn hiện tại">{location.pathname + location.search}</output>;
}
function mount(path) {
  return render(<MemoryRouter initialEntries={[path]}><AppProvider><Documents /><Location /></AppProvider></MemoryRouter>);
}
function withDocuments(documents, handleFile) {
  return vi.fn(async (config) => {
    if (config.url === "/documents" && config.method === "get") return envelope(config, documents);
    if (config.url.endsWith("/file")) return handleFile(config);
    return originalAdapter(config);
  });
}
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:document-preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  if (originalCreate) URL.createObjectURL = originalCreate;
  else delete URL.createObjectURL;
  if (originalRevoke) URL.revokeObjectURL = originalRevoke;
  else delete URL.revokeObjectURL;
});

describe("Document deep links and previews", () => {
  it("clears file type filters when a sidebar link opens notes on the same route", async () => {
    render(<MemoryRouter initialEntries={["/documents?tab=files"]}><AppProvider><Link to="/documents?tab=notes">Mở ghi chú từ sidebar</Link><Documents /></AppProvider></MemoryRouter>);
    await screen.findAllByRole("button", { name: /Xem .*pdf/i });
    fireEvent.click(screen.getByRole("tab", { name: "PDF" }));
    fireEvent.click(screen.getByRole("link", { name: "Mở ghi chú từ sidebar" }));
    expect(await screen.findByText("Những điều cần nhớ về OOP")).toBeTruthy();
    expect(screen.queryByText("Chưa có tài liệu phù hợp")).toBeNull();
  });

  it("opens the linked PDF and removes only its parameter when closed", async () => {
    const spy = withDocuments([
      { id: "doc-a", title: "A.pdf", type: "pdf" },
      { id: "doc-b", title: "B.pdf", type: "pdf" },
    ], (config) => ({ ...envelope(config, null), data: new Blob(["%PDF-1.4"], { type: "application/pdf" }) }));
    apiClient.defaults.adapter = spy;
    mount("/documents?document=doc-b&keep=yes");
    expect(await screen.findByTitle("B.pdf")).toBeTruthy();
    expect(spy.mock.calls.some(([config]) => config.url === "/documents/doc-b/file")).toBe(true);
    expect(spy.mock.calls.some(([config]) => config.url === "/documents/doc-a/file")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(screen.getByLabelText("Đường dẫn hiện tại").textContent).toBe("/documents?keep=yes&tab=files");
    fireEvent.click(screen.getByRole("tab", { name: "PDF" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document-preview");
  });

  it("opens the linked note editor and keeps the notes tab after closing", async () => {
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/notes") return envelope(config, [
        { id: "note-a", title: "Ghi chú A", content: "Nội dung A" },
        { note_id: "note-b", title: "Ghi chú B", content: "Nội dung B" },
      ]);
      return originalAdapter(config);
    };
    mount("/documents?tab=notes&note=note-b");
    expect(await screen.findByDisplayValue("Nội dung B")).toBeTruthy();
    expect(screen.getByLabelText("Tiêu đề").value).toBe("Ghi chú B");
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(screen.getByLabelText("Đường dẫn hiện tại").textContent).toBe("/documents?tab=notes");
    expect(screen.getByRole("tab", { name: "Ghi chú" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.change(screen.getByPlaceholderText("Tìm môn học, chương, slide, tài liệu..."), { target: { value: "Ghi chú B" } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("retries a failed file request and renders image previews directly", async () => {
    let attempt = 0;
    apiClient.defaults.adapter = withDocuments([{ id: "photo", title: "Hình minh họa.png", type: "png" }], (config) => {
      if (++attempt === 1) throw new Error("Tải hình bị gián đoạn");
      return { ...envelope(config, null), data: new Blob(["image"], { type: "image/png" }) };
    });
    mount("/documents?document=photo");
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText("Tải hình bị gián đoạn");
    fireEvent.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    const image = await screen.findByAltText("Hình minh họa.png");
    expect(image.getAttribute("src")).toBe("blob:document-preview");
    expect(attempt).toBe(2);
    expect(dialog.querySelector("iframe")).toBeNull();
  });

  it("rejects uploads above 25 MB before sending binary data", async () => {
    const spy = vi.fn(originalAdapter);
    apiClient.defaults.adapter = spy;
    mount("/documents");
    fireEvent.click(screen.getByRole("button", { name: "Tải tài liệu" }));
    const file = new File(["test"], "too-large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 25 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("Tập tin"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Môn học"), { target: { value: "C#" } });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    await screen.findByText("Tập tin vượt quá giới hạn 25 MB.");
    expect(spy.mock.calls.some(([config]) => config.url === "/documents" && config.method === "post")).toBe(false);
  });
});

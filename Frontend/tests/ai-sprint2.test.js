import assert from "node:assert/strict";
import { state, notifyStateChange } from "../src/app/state.js";
import { runAIAnalysis, getAIAnalysis, progressAnalysisKey } from "../src/features/ai-tutor/ai-analysis.store.js";
import { createNote, deleteNote, addDocument, deleteDocument } from "../src/features/documents/documents.service.js";
import { analyzeDifficultNotes, getLocalStudyData } from "../src/features/ai-tutor/ai-tutor.service.js";
import { requestProgressAdvice } from "../src/features/progress/progress.service.js";
import { renderProgressView } from "../src/features/progress/progress.view.js";
import { renderDocumentsView } from "../src/features/documents/documents.view.js";
import { renderAiScheduleModal } from "../src/features/schedule/schedule.view.js";

export async function runAISprint2Tests() {
  const previousFetch = globalThis.fetch;
  const previousTasks = state.tasks;
  const previousStorage = globalThis.localStorage;
  if (!previousStorage) {
    const storage = new Map();
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  }
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'GET') {
      return { ok: true, json: async () => ({ success: true, data: {} }) };
    }
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return { ok: true, json: async () => ({ success: true, data: { topics: [], suggestions: [] } }) };
  };
  const note = createNote({ title: "CSDL", content: "Phụ thuộc hàm", isDifficult: true });
  const doc = addDocument({ title: "Bài đọc CSDL", subject: "CSDL" });
  try {
    const local = getLocalStudyData();
    assert.equal(local.notes.find(item => item.id === note.id).isDifficult, true);
    assert.equal(local.documents.find(item => item.id === doc.id).title, "Bài đọc CSDL");
    await analyzeDifficultNotes();
    assert.ok(calls.at(-1).url.endsWith("/ai/difficult-notes"));
    assert.ok(calls.at(-1).body.studyData.notes.some(item => item.id === note.id));
    state.tasks = [];
    await requestProgressAdvice("day", "2028-01-01");
    const empty = calls.at(-1).body.progress;
    assert.equal(Object.hasOwn(empty, "tasks"), false);
    assert.equal(Object.hasOwn(empty, "studyTimeMinutes"), false);
    state.tasks = [{ id: "t", title: "Bài tập", subject: "CSDL", status: "Chưa làm" }];
    await requestProgressAdvice("day", "2028-01-01");
    assert.equal(calls.at(-1).body.progress.tasks.total, 1);
    assert.equal(calls.at(-1).body.progress.tasks.completed, 0);
    assert.ok(renderProgressView().includes('id="progressAdviceBtn"'));
    const notesView = renderDocumentsView({ docTab: "notes", activeNoteId: note.id });
    assert.ok(notesView.includes('id="noteDifficultInput" checked'));
    assert.ok(notesView.includes('id="analyzeDifficultNotesBtn"'));
    let complete;
    let requested = 0;
    const pending = runAIAnalysis("difficult-notes", () => {
      requested++;
      return new Promise(resolve => { complete = resolve; });
    }, data => data.text);
    notifyStateChange();
    assert.equal(getAIAnalysis("difficult-notes").pending, true);
    assert.ok(renderDocumentsView({ docTab: "notes", activeNoteId: note.id }).includes('id="analyzeDifficultNotesBtn" disabled'));
    await runAIAnalysis("difficult-notes", () => { requested++; }, () => "");
    assert.equal(requested, 1, "Dựng lại trang không gửi lặp yêu cầu đang chờ");
    complete({ success: true, data: { text: "Ôn <script>alert(1)</script>" } });
    await pending;
    notifyStateChange();
    const completedView = renderDocumentsView({ docTab: "notes", activeNoteId: note.id });
    assert.ok(completedView.includes("&lt;script&gt;"), "Kết quả vẫn hiển thị sau khi dựng lại trang và được escape HTML");
    const key = progressAnalysisKey("week", "2028-01-01");
    await runAIAnalysis(key, async () => ({ success: true, data: { text: "Nhận xét tuần đã chọn" } }), data => data.text);
    assert.ok(renderProgressView({ period: "week", selectedDate: "2028-01-01" }).includes("Nhận xét tuần đã chọn"));
    assert.ok(!renderProgressView({ period: "day", selectedDate: "2028-01-01" }).includes("Nhận xét tuần đã chọn"), "Nhận xét không lẫn giữa các khoảng thời gian");
    const modal = renderAiScheduleModal({ status: "preview", proposals: [{ title: "<script>alert(1)</script>", date: "2028-01-01", start: "09:00", end: "10:00" }] });
    assert.ok(modal.includes('id="applyAiProposalsBtn"'));
    assert.ok(!modal.includes("<script>"));
    console.log("  ✓ Sprint 2 AI frontend: snapshot, real progress, note flags, preview and HTML escaping");
  } finally {
    deleteNote(note.id); deleteDocument(doc.id);
    state.tasks = previousTasks;
    globalThis.fetch = previousFetch;
    if (!previousStorage) delete globalThis.localStorage;
  }
}

import { getHistory, replacePomodoroHistory } from "./pomodoro.storage.js";
import { workspaceRequest } from "../../shared/services/workspace-api.js";

let enabled = false;
let pending = null;
let flushAgain = false;
export const pomodoroSyncStatus = { pending: false, error: "" };
export const isPomodoroSyncEnabled = () => enabled;

export function enablePomodoroSync() { enabled = true; return syncPomodoroHistory(); }

export function syncPomodoroHistory() {
  if (!enabled) return Promise.resolve();
  if (pending) { flushAgain = true; return pending; }
  pomodoroSyncStatus.pending = true;
  pending = (async () => {
    do {
      flushAgain = false;
      const stored = await workspaceRequest("GET", "/pomodoro", { silent: true });
      const known = new Set(stored.map(item => item.id));
      for (const item of getHistory()) {
        if (!known.has(item.id) && !item.synced) {
          const saved = await workspaceRequest("POST", "/pomodoro", { body: item, silent: true });
          stored.push(saved); known.add(item.id);
        }
      }
      // A session may finish while a fetch is in flight. Retain it for the next flush.
      const unsaved = getHistory().filter(item => !known.has(item.id) && !item.synced);
      if (unsaved.length) flushAgain = true;
      replacePomodoroHistory([...unsaved, ...stored].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      pomodoroSyncStatus.error = "";
    } while (flushAgain);
  })().catch(error => { pomodoroSyncStatus.error = `Chưa lưu lịch sử lên máy chủ: ${error.message}`; })
    .finally(() => { pending = null; pomodoroSyncStatus.pending = false; });
  return pending;
}

export async function clearServerPomodoroHistory() {
  if (!enabled) { replacePomodoroHistory([]); return; }
  if (pending) await pending;
  await workspaceRequest("DELETE", "/pomodoro");
  replacePomodoroHistory([]);
}

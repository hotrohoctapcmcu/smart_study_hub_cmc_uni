import assert from "node:assert/strict";
import { fetchServerProgress, fetchServerTimeMap } from "../src/features/progress/progress.service.js";
import { renderProgressView } from "../src/features/progress/progress.view.js";
import { updateTaskApi, deleteTaskApi } from "../src/features/tasks/tasks.service.js";
import { state } from "../src/app/state.js";

export async function runBranchIntegrationTests() {
  const previousFetch = globalThis.fetch;
  const previousTasks = state.tasks;
  const requests = [];
  let rejectDelete = false;
  const metrics = {
    overdueCount: 2,
    weeklyStudyHours: { totalHours: 1.5, selfStudyHours: 1, pomodoroHours: 0.5, weekStart: "2028-02-21", weekEnd: "2028-02-28", warnings: [] },
    subjects: [{ subjectName: "<script>unsafe</script>", totalAssignments: 2, completedAssignments: 1, completionRate: 50 }],
    gpaBySemester: [], nextExam: null
  };
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    requests.push({ path: parsed.pathname, query: parsed.searchParams, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    const failed = rejectDelete && options.method === "DELETE";
    const data = parsed.pathname.endsWith('/progress') ? { metrics, advice: null }
      : parsed.pathname.endsWith('/timemap') ? { "2028-02-29": [{ type: 'exam', title: '<unsafe>', startTime: '2028-02-29T08:00:00+07:00', endTime: '2028-02-29T09:00:00+07:00' }] }
      : parsed.pathname.endsWith('/checklist') && options.method === 'POST' ? { checklist_id: 8 }
      : [];
    return { ok: !failed, status: failed ? 403 : 200, json: async () => failed ? { message: 'Delete denied' } : { success: true, data, meta: { warnings: [] } } };
  };
  try {
    const report = await fetchServerProgress();
    assert.equal(report.metrics.weeklyStudyHours.totalHours, 1.5);
    assert.equal(requests[0].query.get('advice'), 'false');
    const map = await fetchServerTimeMap('month', '2028-02-09');
    assert.equal(requests.at(-1).query.get('from'), '2028-02-01');
    assert.equal(requests.at(-1).query.get('to'), '2028-02-29');
    const html = renderProgressView({ period: 'month', selectedDate: '2028-02-09', serverProgress: report, serverTimeMap: map });
    assert.ok(html.includes('1.5 giờ học'));
    assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
    assert.ok(html.includes('&lt;unsafe&gt;'));
    assert.ok(html.includes('08:00–09:00'));

    await updateTaskApi('task-7', {
      removedChecklistIds: [3],
      checklist: [{ backendId: 4, text: 'Retained', done: true }, { text: 'Added', done: false }]
    });
    assert.ok(requests.some(r => r.method === 'DELETE' && r.path.endsWith('/tasks/checklist/3')));
    assert.ok(requests.some(r => r.method === 'PUT' && r.path.endsWith('/tasks/checklist/4')));
    assert.ok(requests.some(r => r.method === 'PATCH' && r.path.endsWith('/tasks/checklist/4/done') && r.body.isCompleted));
    assert.ok(requests.some(r => r.method === 'POST' && r.path.endsWith('/tasks/7/checklist')));
    assert.ok(requests.some(r => r.method === 'PATCH' && r.path.endsWith('/tasks/checklist/8/done') && !r.body.isCompleted));

    state.tasks = [{ id: 'task-7', title: 'Must remain on failure' }];
    rejectDelete = true;
    await assert.rejects(deleteTaskApi('task-7'), /Delete denied/);
    assert.equal(state.tasks.length, 1);
    rejectDelete = false;
    await deleteTaskApi('edux-subject-model');
    assert.ok(requests.some(r => r.method === 'DELETE' && r.path.endsWith('/tasks/edux-subject-model')));
    console.log('  ✓ Branch integration: server progress, Time Map, checklist persistence and failed deletes');
  } finally {
    globalThis.fetch = previousFetch;
    state.tasks = previousTasks;
  }
}

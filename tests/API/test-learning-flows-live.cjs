'use strict';
// Real provider, synthetic study data, no application database writes.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-flows-live-'));
process.env.GEMINI_SESSION_DIR = directory;
process.env.GEMINI_TIMEOUT_MS = '25000';
const report = { checkedAt: new Date().toISOString(), provider: 'real', data: 'synthetic', databaseWrites: 0, checks: [] };
async function main() {
    if (process.env.GEMINI_ORIGIN && new URL(process.env.GEMINI_ORIGIN).hostname !== 'gemini.google.com') throw new Error('Live check requires the real provider origin.');
    const { createPomodoroGoalService, validGoalPlan } = require('../../API/services/pomodoro-goals.service');
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), year = Number(today.slice(0, 4));
    const service = createPomodoroGoalService({ userId: 1, getDb: () => ({
        layThoiKhoaBieu: async () => [{ source: 'IU', subject_id: 1, subject_name: 'Cơ sở dữ liệu', semester: '1', academic_year: `${year}-${year + 1}`, start_date: `${year}-01-01`, end_date: `${year}-12-31` }],
        layHoSo: async () => ({ student_id: 1 }), executeQuery: async () => [{ title: 'Luyện JOIN', subject_id: 1, subject_name: 'Cơ sở dữ liệu', description: 'Viết 3 truy vấn INNER JOIN trên hai bảng mẫu và giải thích kết quả.', deadline: `${year + 1}-01-01T20:00` }]
    }) });
    const started = Date.now();
    const result = await service.breakdown({ kind: 'task', goal: 'Luyện JOIN', subjectId: 1, taskId: '1', taskSource: 'PERSONAL', durationMinutes: 120 }, { signal: AbortSignal.timeout(55000) });
    assert.equal(result.persisted, false); assert.equal(validGoalPlan(result, 120), true);
    report.checks.push({ name: 'Task breakdown schema, outputs and duration', passed: true, steps: result.steps.length, elapsedMs: Date.now() - started });
}
main().catch(error => {
    report.checks.push({ name: 'Task breakdown schema, outputs and duration', passed: false, code: error.code || error.name, message: error.message });
    process.exitCode = 1;
}).finally(() => {
    const target = path.resolve(__dirname, '../../docs/evidence/learning-flows-live.json');
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('learning-flows-live-'));
    fs.rmSync(directory, { recursive: true, force: true });
    console.log(JSON.stringify(report, null, 2));
});

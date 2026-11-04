'use strict';
// Opt-in real provider check. Synthetic text only; never opens the application DB.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-recovery-live-'));
process.env.GEMINI_SESSION_DIR = directory;
const report = { checkedAt: new Date().toISOString(), provider: 'real', data: 'synthetic', databaseWrites: 0, checks: [] };
async function main() {
    if (process.env.GEMINI_ORIGIN && new URL(process.env.GEMINI_ORIGIN).hostname !== 'gemini.google.com') throw new Error('Real provider origin required.');
    const ai = require('../../API/utils/gemini-client');
    const { summarizeInBatches } = require('../../API/utils/course-summary-ai');
    const { generateCardBatch } = require('../../API/utils/course-cards-ai');
    report.mode = ai.getStatus().mode;
    const signal = AbortSignal.timeout(55000), cache = new Map();
    let metadata, stage = 'summary';
    const started = Date.now();
    try {
        const summary = await summarizeInBatches({ subject: 'Cơ sở dữ liệu (dữ liệu thử tổng hợp)' },
            'INNER JOIN chỉ giữ các cặp dòng thỏa điều kiện ghép. LEFT JOIN giữ mọi dòng bên trái; khi không khớp, cột bên phải là NULL. WHERE lọc dòng trước khi nhóm; HAVING lọc nhóm sau GROUP BY.', {
                singlePass: true, load: key => cache.get(key), save: (key, value) => cache.set(key, value), onFormat: value => { metadata = value; },
                ask: prompt => ai.ask(prompt, { signal, timeoutMs: 25000, retry: false })
            });
        assert.ok(summary.trim());
        report.checks.push({ name: stage, passed: true, chars: summary.length, format: metadata?.format, elapsedMs: Date.now() - started });
        stage = 'cards';
        const cards = await generateCardBatch({ subject: 'Cơ sở dữ liệu', text: summary,
            generate: (prompt, config) => ai.generateJson(prompt, { ...config, signal, timeoutMs: 25000, retry: false }) });
        report.checks.push({ name: stage, passed: true, count: cards.length, elapsedMs: Date.now() - started });
    } catch (error) {
        report.checks.push({ name: stage, passed: false, code: error.code || error.name, message: error.message, elapsedMs: Date.now() - started });
        if (stage === 'summary') report.checks.push({ name: 'cards', skipped: true, reason: 'No real summary returned.' });
        process.exitCode = 1;
    }
}
main().catch(error => { report.error = { code: error.code || error.name, message: error.message }; process.exitCode = 1; }).finally(() => {
    fs.writeFileSync(path.resolve(__dirname, '../../docs/evidence/learning-recovery-live.json'), JSON.stringify(report, null, 2) + '\n');
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('learning-recovery-live-'));
    fs.rmSync(directory, { recursive: true, force: true });
    console.log(JSON.stringify(report, null, 2));
});

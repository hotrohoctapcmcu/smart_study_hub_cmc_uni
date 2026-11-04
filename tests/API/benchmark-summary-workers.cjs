'use strict';
// Synthetic latency benchmark, not an AI-provider speed/quality measurement.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { summarizeInBatches } = require('../../API/utils/course-summary-ai');
const text = 'BEGIN\n' + 'Normalized study knowledge.\n'.repeat(2400) + 'EXACT_END';
const latencyMs = 50;
async function measure(parallelism) {
    const cache = new Map(), sources = [];
    let active = 0, maximum = 0, requests = 0, metadata;
    const started = performance.now();
    const answer = await summarizeInBatches({ subject: 'Synthetic performance fixture' }, text, {
        parallelism, chunkChars: 12000,
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), onFormat: value => { metadata = value; },
        ask: async prompt => {
            requests++; maximum = Math.max(maximum, ++active);
            try {
                await new Promise(resolve => setTimeout(resolve, latencyMs));
                const part = prompt.match(/NỘI DUNG PHẦN ([AB](?:\.\d+)*):\n([\s\S]*)$/);
                if (part) { sources.push({ label: part[1], text: part[2] }); return `Summary ${part[1]}.`; }
                return 'Complete synthetic summary.';
            } finally { active--; }
        }
    });
    assert.equal(answer, 'Complete synthetic summary.');
    assert.equal(sources.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })).map(part => part.text).join(''), text);
    assert.equal(requests, metadata.totalParts + 1); assert.ok(maximum <= parallelism);
    return { parallelism, parts: metadata.totalParts, requests, maximumConcurrentRequests: maximum, elapsedMs: Math.round(performance.now() - started), exactSourceCoverage: true };
}
async function main() {
    const serial = await measure(1), parallel = await measure(4);
    const report = { checkedAt: new Date().toISOString(), provider: 'mock', fixedRequestLatencyMs: latencyMs, sourceChars: text.length,
        serial, parallel, observedSpeedup: Number((serial.elapsedMs / parallel.elapsedMs).toFixed(2)),
        limitation: 'Controlled synthetic latency only; does not measure real provider throughput, rate limits or answer quality.' };
    fs.writeFileSync(path.resolve(__dirname, '../../docs/evidence/learning-parallel-benchmark.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

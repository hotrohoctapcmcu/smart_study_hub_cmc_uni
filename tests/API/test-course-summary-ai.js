'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitInTwo, summarizeInBatches } = require('../../API/utils/course-summary-ai');
const source = prompt => prompt.match(/NỘI DUNG PHẦN ([AB](?:\.\d+)*):\n([\s\S]*)$/);

test('A/B splits preserve every character, source order and Unicode boundaries', () => {
    for (const text of ['MÔN\r\n\r\n[1] A\r\n💡 kiến thức\r\n\r\n[2] B\r\nNội dung cuối', '😀'.repeat(1001), 'z'.repeat(10001)]) {
        const [a, b] = splitInTwo(text);
        assert.ok(a.length && b.length); assert.equal(a + b, text);
        assert.ok(!/[\uD800-\uDBFF]$/.test(a)); assert.ok(!/^[\uDC00-\uDFFF]/.test(b));
    }
});

test('A and B are submitted before the final merge; retries reuse saved parts', async () => {
    const text = 'Kiến thức đầu môn. '.repeat(300) + 'KIẾN_THỨC_CUỐI_MÔN';
    const cache = new Map(), calls = [], leaves = [];
    const options = { load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            calls.push(prompt);
            const part = source(prompt);
            if (part) { leaves.push(part[2]); return `SUMMARY_${part[1]}`; }
            assert.ok(prompt.includes('SUMMARY_A') && prompt.includes('SUMMARY_B'));
            return 'Bản tóm tắt cuối bao quát cả hai phần.';
        }
    };
    const answer = await summarizeInBatches({ subject: 'Môn thử' }, text, options);
    assert.equal(calls.length, 3); assert.equal(source(calls[0])[1], 'A'); assert.equal(source(calls[1])[1], 'B');
    assert.equal(leaves.join(''), text); assert.ok(!source(calls[2]));
    assert.equal(await summarizeInBatches({ subject: 'Môn thử' }, text, options), answer);
    assert.equal(calls.length, 3);
});

test('n source parts run with four concurrent AI requests, merge once in source order, and keep the exact tail', async () => {
    const text = Array.from({ length: 80 }, (_, i) => `[${i}] Định nghĩa chương ${i}. 💡\n`).join('') + 'KIẾN_THỨC_CUỐI';
    const cache = new Map(), sources = [], finishedLabels = [], mergedLabels = [], states = [];
    let release, active = 0, maximum = 0, sourceCalls = 0, mergeCalls = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const pending = summarizeInBatches({ subject: 'Môn song song' }, text, {
        chunkChars: 512, parallelism: 4, limits: { inputChars: 12000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), update: (_message, _progress, details) => states.push(details),
        ask: async prompt => {
            maximum = Math.max(maximum, ++active);
            try {
                const part = source(prompt);
                if (part) {
                    sourceCalls++; sources.push({ label: part[1], text: part[2] }); await gate;
                    await new Promise(resolve => setTimeout(resolve, part[1].endsWith('.1') ? 15 : 1));
                    finishedLabels.push(part[1]); return `SAVED_${part[1]}`;
                }
                mergeCalls++; assert.equal(active, 1, 'source workers have all finished before merging');
                for (const part of [...sources].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))) {
                    mergedLabels.push(prompt.indexOf(`SAVED_${part.label}`));
                }
                return 'Bản tổng hợp đủ nguồn.';
            } finally { active--; }
        }
    });
    try {
        for (let i = 0; i < 100 && active < 4; i++) await new Promise(resolve => setImmediate(resolve));
        assert.equal(active, 4); assert.equal(sourceCalls, 4, 'only four requests start while they are blocked');
    } finally { release(); }
    assert.equal(await pending, 'Bản tổng hợp đủ nguồn.');
    assert.ok(sourceCalls > 4); assert.equal(maximum, 4); assert.equal(mergeCalls, 1);
    assert.equal(sources.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })).map(part => part.text).join(''), text);
    assert.notDeepEqual(finishedLabels, sources.map(part => part.label), 'responses actually finish out of order');
    assert.ok(mergedLabels.every((offset, index) => offset >= 0 && (!index || offset > mergedLabels[index - 1])));
    assert.ok(states.some(state => state.completedParts === sourceCalls && state.totalParts === sourceCalls && state.summaryStage === 'merge'));
});

test('one failed parallel part waits for siblings to save; retry only regenerates that part', async () => {
    const text = 'Kiến thức có thứ tự. '.repeat(180), cache = new Map();
    let fail = true, calls = 0, settled = false, release;
    const gate = new Promise(resolve => { release = resolve; });
    const options = { chunkChars: 512, parallelism: 3, limits: { inputChars: 12000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            const part = source(prompt);
            if (!part) return 'Bản tổng hợp thật.';
            calls++;
            if (calls === 1 && fail) throw Object.assign(new Error('Failed one part'), { code: 'GEMINI_SCHEMA' });
            await gate; return `SUMMARY_${part[1]}`;
        }
    };
    const pending = summarizeInBatches({ subject: 'Môn thử' }, text, options);
    const rejected = assert.rejects(pending, { code: 'GEMINI_SCHEMA' }).then(() => { settled = true; });
    try {
        for (let i = 0; i < 100 && calls < 4; i++) await new Promise(resolve => setImmediate(resolve));
        assert.ok(calls >= 4); assert.equal(settled, false, 'course queue must not advance while siblings are active');
    } finally { release(); }
    await rejected;
    const before = calls;
    assert.equal(cache.size, before - 1, 'every successful source part persisted despite a sibling failure');
    fail = false;
    assert.equal(await summarizeInBatches({ subject: 'Môn thử' }, text, options), 'Bản tổng hợp thật.');
    assert.equal(calls, before + 1);
});

test('execution configuration bounds parallelism and source size independently of cache keys', () => {
    const { summaryExecution } = require('../../API/utils/course-summary-ai');
    assert.deepEqual(summaryExecution({ inputChars: 4000 }, { parallelism: 999, chunkChars: 999999 }), { parallelism: 5, chunkChars: 3000 });
    assert.deepEqual(summaryExecution({ inputChars: 60000 }, { parallelism: -1, chunkChars: -1 }), { parallelism: 1, chunkChars: 512 });
});

test('oversized intermediate results merge in parallel groups without exceeding the request budget', async () => {
    const cache = new Map(); let activeGroups = 0, maximumGroups = 0;
    const leaves = [], groupCalls = [];
    const text = 'Dữ liệu của từng chương. '.repeat(160);
    await summarizeInBatches({ subject: 'Môn nhiều phần' }, text, {
        chunkChars: 512, parallelism: 3, limits: { inputChars: 4000, partChars: 1400, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            assert.ok(prompt.length <= 4000);
            const part = source(prompt);
            if (part) { leaves.push({ label: part[1], text: part[2] }); return `${part[1]}: ${'Kiến thức. '.repeat(110)}`; }
            if (!prompt.includes('G1.') && !prompt.includes('G2.') && !prompt.includes('G3.')) return 'Bản cuối.';
            groupCalls.push(prompt); maximumGroups = Math.max(maximumGroups, ++activeGroups);
            try { await new Promise(resolve => setImmediate(resolve)); return 'Đã tổng hợp nhóm.'; }
            finally { activeGroups--; }
        }
    });
    assert.ok(groupCalls.length > 1); assert.ok(maximumGroups > 1 && maximumGroups <= 3);
    assert.equal(leaves.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })).map(part => part.text).join(''), text);
});

test('oversized courses are split within A/B without losing the tail or exceeding request limits', async () => {
    const text = Array.from({ length: 60 }, (_, i) => `[${i}] Bài ${i}\n${'Kiến thức. '.repeat(80)}\n`).join('') + 'CUỐI_MÔN';
    const leaves = [], cache = new Map();
    const answer = await summarizeInBatches({ subject: 'Môn dài' }, text, {
        limits: { inputChars: 4000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            assert.ok(prompt.length <= 4000);
            const part = source(prompt);
            if (part) leaves.push({ label: part[1], text: part[2] });
            return part ? `Kiến thức ${part[1]}` : 'Tổng hợp kiến thức của các phần đã gửi.';
        }
    });
    leaves.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
    assert.ok(leaves.length > 2); assert.equal(leaves.map(part => part.text).join(''), text);
    assert.ok(answer.length <= 1400);
});

test('provider response size errors trigger smaller source requests and concise merge output', async () => {
    const text = 'Định nghĩa và thuật toán. '.repeat(450);
    const cache = new Map(), leaves = []; let rejected = 0;
    await summarizeInBatches({ subject: 'Tự điều chỉnh' }, text, {
        limits: { inputChars: 12000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            const part = source(prompt);
            if (part && part[2].length > 3000) { rejected++; throw Object.assign(new Error('Phản hồi quá lớn'), { code: 'GEMINI_RESPONSE_SIZE' }); }
            if (part) leaves.push({ label: part[1], text: part[2] });
            return part ? `Tóm tắt ${part[1]}` : 'Kiến thức đã tổng hợp.';
        }
    });
    leaves.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
    assert.ok(rejected > 0); assert.equal(leaves.map(part => part.text).join(''), text);
});

test('long AI output is requested again with a smaller budget instead of being truncated', async () => {
    let oversized = true, tightened = false;
    const cache = new Map();
    const result = await summarizeInBatches({ subject: 'Bản tóm tắt ngắn' }, 'Kiến thức. '.repeat(100), {
        limits: { inputChars: 6000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            if (oversized) { oversized = false; return 'x'.repeat(701); }
            if (prompt.includes('tối đa 350 ký tự')) tightened = true;
            return 'Bản tóm tắt ngắn, đầy đủ ý chính.';
        }
    });
    assert.equal(tightened, true); assert.equal(result, 'Bản tóm tắt ngắn, đầy đủ ý chính.');
    assert.ok([...cache.entries()].filter(([key]) => !key.startsWith('draft:')).every(([, text]) => !text.includes('xxx')));
});

test('a size-refused merge exposes real AI sections; a later attempt reuses A and B', async () => {
    const cache = new Map(), calls = [];
    let broken = true;
    const options = { load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            calls.push(prompt);
            const part = source(prompt);
            if (part) return `SUMMARY_${part[1]}`;
            if (broken) throw Object.assign(new Error('Phản hồi Gemini quá lớn.'), { code: 'GEMINI_RESPONSE_SIZE' });
            return 'Bản tổng hợp A và B.';
        }
    };
    let metadata;
    const answer = await summarizeInBatches({ subject: 'Môn thử' }, 'Nội dung. '.repeat(100), { ...options, onFormat: value => { metadata = value; } });
    assert.match(answer, /SUMMARY_A[\s\S]*SUMMARY_B/);
    assert.equal(metadata.format, 'sections'); assert.ok(metadata.notice.includes('Chưa có bản tổng hợp ngắn'));
    assert.equal(cache.size, 2); assert.equal(calls.length, 4);
    broken = false;
    assert.equal(await summarizeInBatches({ subject: 'Môn thử' }, 'Nội dung. '.repeat(100), options), 'Bản tổng hợp A và B.');
    assert.equal(calls.length, 5); assert.equal(source(calls[4]), null);
});

test('repeatedly verbose output is rewritten from its real draft and saved without truncation or source resplitting', async () => {
    const cache = new Map(), calls = []; let metadata;
    const draft = 'Định nghĩa và kết luận đầy đủ. '.repeat(70) + 'KẾT_THÚC';
    const answer = await summarizeInBatches({ subject: 'Môn dài' }, 'Nguồn. '.repeat(200), {
        singlePass: true, limits: { inputChars: 6000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), onFormat: value => { metadata = value; },
        ask: async prompt => { calls.push(prompt); return draft; }
    });
    assert.equal(calls.length, 3); assert.ok(calls[2].includes(draft));
    assert.equal(answer, draft); assert.equal(metadata.format, 'expanded'); assert.equal(metadata.actualChars, draft.length);
});

test('overlong real draft survives a failed rewrite; retry only rewrites and retains provider errors', async () => {
    const cache = new Map(), calls = []; let fail = true;
    const draft = 'Nội dung AI đã tạo. '.repeat(100);
    const options = { singlePass: true, limits: { inputChars: 6000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => {
            calls.push(prompt);
            if (prompt.includes('BẢN NHÁP CẦN RÚT GỌN:')) {
                if (fail) throw Object.assign(new Error('Provider down'), { code: 'GEMINI_NETWORK' });
                return 'Bản rút gọn thực.';
            }
            return draft;
        }
    };
    await assert.rejects(summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), options), { code: 'GEMINI_NETWORK' });
    assert.equal(calls.length, 3); fail = false;
    assert.equal(await summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), options), 'Bản rút gọn thực.');
    assert.equal(calls.length, 4); assert.ok(calls[3].includes(draft.trim()));
});

test('merge request that exceeds the actual input budget yields explicitly labelled AI sections', async () => {
    let metadata; const cache = new Map(); let calls = 0;
    const answer = await summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), {
        limits: { inputChars: 4000, partChars: 2000, summaryChars: 3000 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), onFormat: value => { metadata = value; },
        ask: async () => { calls++; return 'Kiến thức AI. '.repeat(140); }
    });
    assert.equal(calls, 2); assert.equal(metadata.format, 'sections'); assert.ok(answer.includes('## Phần A') && answer.includes('## Phần B'));
});

test('storage cap remains a real error and never becomes a successful truncated summary', async () => {
    const cache = new Map();
    await assert.rejects(summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), {
        singlePass: true, limits: { inputChars: 4000, partChars: 700, summaryChars: 1400, storedChars: 5000 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), ask: async () => 'x'.repeat(6000)
    }), { code: 'LEARNING_SUMMARY_STORAGE_SIZE' });
    assert.equal(cache.size, 0);
});

test('adding a storage cap preserves cached parts written by the original v3 pipeline', async () => {
    const { fingerprint } = require('../../API/utils/course-material-text');
    const text = 'Nguồn cũ '.repeat(100), oldLimits = { inputChars: 6000, partChars: 700, summaryChars: 1400 };
    const halves = splitInTwo(text), cache = new Map();
    for (const [index, label] of ['A', 'B'].entries()) cache.set(fingerprint([3, oldLimits, 'source', label, halves[index]]), `CACHED_${label}`);
    let calls = 0;
    await summarizeInBatches({ subject: 'Môn' }, text, {
        limits: { ...oldLimits, storedChars: 120000 }, load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async prompt => { calls++; assert.ok(prompt.includes('CACHED_A') && prompt.includes('CACHED_B')); return 'Bản tổng hợp thực.'; }
    });
    assert.equal(calls, 1);
});

test('a later size refusal does not discard an already generated valid draft', async () => {
    const cache = new Map(); let calls = 0;
    const draft = 'Nội dung AI nguyên vẹn. '.repeat(100).trim();
    const result = await summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), {
        singlePass: true, limits: { inputChars: 6000, partChars: 700, summaryChars: 1400 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value),
        ask: async () => { calls++; if (calls > 1) throw Object.assign(new Error('Too big'), { code: 'GEMINI_RESPONSE_SIZE' }); return draft; }
    });
    assert.equal(result, draft); assert.equal(calls, 3);
});

test('a merge above the storage cap falls back only to the actual completed AI sections', async () => {
    const cache = new Map(); let metadata;
    const result = await summarizeInBatches({ subject: 'Môn' }, 'Nguồn '.repeat(100), {
        limits: { inputChars: 4000, partChars: 700, summaryChars: 1400, storedChars: 5000 },
        load: key => cache.get(key), save: (key, value) => cache.set(key, value), onFormat: value => { metadata = value; },
        ask: async prompt => source(prompt) ? `AI_${source(prompt)[1]}` : 'x'.repeat(6000)
    });
    assert.equal(metadata.format, 'sections'); assert.match(result, /AI_A[\s\S]*AI_B/);
    assert.ok(!result.includes('xxx') && !result.includes('Nguồn'));
});

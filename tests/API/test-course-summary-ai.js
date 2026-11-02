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

test('A completes before B, then both summaries are merged; retries reuse saved parts', async () => {
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
    assert.ok([...cache.values()].every(text => !text.includes('xxx')));
});

test('a failed final merge retains A and B and retries only the merge', async () => {
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
    await assert.rejects(summarizeInBatches({ subject: 'Môn thử' }, 'Nội dung. '.repeat(100), options),
        error => error.code === 'LEARNING_MERGE_SIZE' && error.message.includes('A và B đã được lưu'));
    assert.equal(cache.size, 2); assert.equal(calls.length, 4);
    broken = false;
    assert.equal(await summarizeInBatches({ subject: 'Môn thử' }, 'Nội dung. '.repeat(100), options), 'Bản tổng hợp A và B.');
    assert.equal(calls.length, 5); assert.equal(source(calls[4]), null);
});

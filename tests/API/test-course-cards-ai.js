'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cardBatches, generateCardBatch } = require('../../API/utils/course-cards-ai');

test('flashcard batches retain all Unicode summary text and use stable checkpoint keys', () => {
    const text = 'Chương 1 💡 định nghĩa.\n'.repeat(500) + 'KIẾN_THỨC_CUỐI';
    const batches = cardBatches(text);
    assert.ok(batches.length > 1); assert.equal(batches.map(batch => batch.text).join(''), text);
    assert.deepEqual(cardBatches(text), batches);
    for (const batch of batches) { assert.ok(batch.text.length <= 3500); assert.ok(!/[\uD800-\uDBFF]$/.test(batch.text)); }
});

test('invalid JSON and schema shrink 4 to 2 to 1 cards with a bounded repair on the smallest request', async () => {
    const calls = [];
    const cards = await generateCardBatch({ subject: 'SQL', text: 'Bản AI thật', generate: async (prompt, config) => {
        calls.push({ prompt, config }); assert.ok(prompt.endsWith('Bản AI thật'));
        if (calls.length === 1) throw Object.assign(new Error('Malformed'), { code: 'GEMINI_JSON' });
        if (calls.length === 2) return { cards: [{ front: 'Thiếu đáp án' }] };
        const output = { cards: [{ front: 'Q "quoted"', back: 'C:\\tmp\\file\nconst x = { a: 1 };' }] };
        assert.equal(config.validate(output), true); return output;
    } });
    assert.equal(cards.length, 1); assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(call => call.config.retryMalformed), [false, false, true]);
    assert.ok(calls[0].prompt.includes('4 thẻ') && calls[1].prompt.includes('2 thẻ') && calls[2].prompt.includes('1 thẻ'));
});

test('consistently invalid or oversized flashcards fail honestly after three sizes', async () => {
    for (const code of ['GEMINI_JSON', 'GEMINI_SCHEMA', 'GEMINI_RESPONSE_SIZE']) {
        let calls = 0;
        await assert.rejects(generateCardBatch({ subject: 'SQL', text: 'AI summary', generate: async () => {
            calls++; throw Object.assign(new Error('Bad output'), { code });
        } }), error => error.code === code && error.stage === 'cards' && error.message.includes('các lô Flashcard đã xong'));
        assert.equal(calls, 3);
    }
});

test('provider/network errors do not pretend to be malformed JSON or produce fallback cards', async () => {
    let calls = 0;
    await assert.rejects(generateCardBatch({ subject: 'SQL', text: 'AI summary', generate: async () => {
        calls++; throw Object.assign(new Error('Offline'), { code: 'GEMINI_NETWORK' });
    } }), { code: 'GEMINI_NETWORK' });
    assert.equal(calls, 1);
});

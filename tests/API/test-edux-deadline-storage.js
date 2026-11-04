'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-edux-deadlines-'));
process.env.DB_PATH = path.join(directory, 'test.db');
process.env.NODE_ENV = 'test';

test('EDUX deadlines persist and distinguish removed dates from unavailable lookups', async t => {
    const db = await require('../../database')();
    t.after(async () => {
        await db.closePool();
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const task = { id: 'edux-subject-model', title: 'Bài tập nhóm', subject: 'Cơ sở dữ liệu', subjectId: 'subject', modelId: 'model' };
    const firstDue = '2026-11-03T23:59:00+07:00';
    const subjectStartTime = '2026-10-01T00:00:00+07:00';
    await db.luuBaiTapEDUX(1, [{ ...task, due: firstDue, dueSource: 'subject', subjectDeadline: firstDue, subjectStartTime, status: 'Đang làm' }]);
    await db.luuBaiTapEDUX(2, [{ ...task, due: '2026-12-01' }]);
    assert.equal((await db.layBaiTapEDUX(1))[0].due, firstDue);
    assert.equal((await db.layBaiTapEDUX(1))[0].dueSource, 'subject');
    assert.equal((await db.layBaiTapEDUX(1))[0].subjectDeadline, firstDue);
    assert.equal((await db.layBaiTapEDUX(1))[0].subjectStartTime, subjectStartTime);
    assert.equal((await db.executeQuery('SELECT deadline FROM EduxAssignments WHERE user_id=@uid', { uid: '1' }))[0].deadline, firstDue);

    await db.executeQuery('UPDATE EduxAssignments SET tags=@tags WHERE user_id=@uid', { tags: '["Cần ôn"]', uid: '1' });
    await db.capNhatTrangThaiBaiTapEDUX(1, task.id, 'Hoàn thành');
    const changedDue = '2026-11-05T16:59:00.000Z';
    await db.luuBaiTapEDUX(1, [{ ...task, due: new Date(changedDue), dueSource: 'exam' }]);
    let saved = (await db.layBaiTapEDUX(1))[0];
    assert.equal(saved.due, changedDue);
    assert.equal(saved.dueSource, 'exam');
    assert.equal(saved.subjectDeadline, firstDue, 'exam date does not replace the subject limit');
    assert.equal(saved.subjectStartTime, subjectStartTime);
    assert.equal(saved.status, 'Hoàn thành');
    assert.deepEqual(saved.tags, ['Cần ôn']);
    assert.equal((await db.layBaiTapEDUX(2))[0].due, '2026-12-01');

    await db.luuBaiTapEDUX(1, [{ ...task, due: undefined }]);
    assert.equal((await db.layBaiTapEDUX(1))[0].due, changedDue, 'unavailable deadline lookup retains the last known date');
    await db.closePool();
    saved = (await db.layBaiTapEDUX(1))[0];
    assert.equal(saved.due, changedDue, 'deadline survives application restart');
    assert.equal(saved.dueSource, 'exam');
    assert.equal(saved.subjectDeadline, firstDue);
    assert.equal(saved.subjectStartTime, subjectStartTime);

    await db.luuBaiTapEDUX(1, [{ ...task, due: null, dueSource: null, subjectDeadline: null, subjectStartTime: null }]);
    saved = (await db.layBaiTapEDUX(1))[0];
    assert.equal(saved.due, null, 'explicit removal clears the old deadline');
    assert.equal(saved.dueSource, null);
    assert.equal(saved.subjectDeadline, null);
    assert.equal(saved.subjectStartTime, null);
    assert.equal(saved.status, 'Hoàn thành');
    assert.deepEqual(saved.tags, ['Cần ôn']);

    await db.luuBaiTapEDUX(1, [{ ...task, deadline: '2026-11-06' }]);
    assert.equal((await db.layBaiTapEDUX(1))[0].due, '2026-11-06', 'legacy deadline input also round trips');
    await assert.rejects(db.luuBaiTapEDUX(1, [{ ...task, dueSource: 'unrecognized' }]), /dueSource/);
    assert.equal((await db.layBaiTapEDUX(1))[0].due, '2026-11-06', 'invalid metadata never overwrites a saved deadline');

    await t.test('EDUX completion time persists without treating sync time as completion', async () => {
        const done = { ...task, id: 'completion', status: 'Hoàn thành', progress: { daHoc: 5, tongSo: 5 } };
        await db.luuBaiTapEDUX(3, [done]);
        assert.equal((await db.layBaiTapEDUX(3))[0].completedAt, null, 'first import cannot infer when completed work was done');
        await db.capNhatTrangThaiBaiTapEDUX(3, done.id, 'Chưa làm');
        await db.capNhatTrangThaiBaiTapEDUX(3, done.id, 'Hoàn thành');
        const timestamp = (await db.layBaiTapEDUX(3))[0].completedAt;
        assert.ok(timestamp.endsWith('Z'), 'SQLite UTC time has an explicit offset in the API');
        assert.ok(Math.abs(Date.now() - Date.parse(timestamp)) < 5000);
        await db.executeQuery("UPDATE EduxAssignments SET completed_at='2026-10-25 17:01:00' WHERE user_id=3");
        await db.capNhatTrangThaiBaiTapEDUX(3, done.id, 'Hoàn thành');
        await db.luuBaiTapEDUX(3, [done]);
        assert.equal((await db.layBaiTapEDUX(3))[0].completedAt, '2026-10-25T17:01:00Z', 'repeated completed sync does not move work to the current week');
        await db.luuBaiTapEDUX(3, [{ ...task, id: done.id }]);
        await db.closePool();
        assert.equal((await db.layBaiTapEDUX(3))[0].completedAt, '2026-10-25T17:01:00Z', 'a partial sync and app restart preserve the known completion time');
        await db.luuBaiTapEDUX(3, [{ ...done, status: 'Đang làm' }]);
        assert.equal((await db.layBaiTapEDUX(3))[0].completedAt, null, 'remote reopening clears the old completion time');
        await db.capNhatTrangThaiBaiTapEDUX(3, done.id, 'Hoàn thành');
        await db.capNhatTrangThaiBaiTapEDUX(3, done.id, 'Chưa làm');
        assert.equal((await db.layBaiTapEDUX(3))[0].completedAt, null, 'local reopening clears the old completion time');
    });
});

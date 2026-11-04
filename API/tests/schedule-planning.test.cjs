'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

test('manual scheduling rejects elapsed times over HTTP and preserves history', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-planning-'));
    const previous = { DB_PATH: process.env.DB_PATH, APP_USER_ID: process.env.APP_USER_ID };
    process.env.DB_PATH = path.join(directory, 'test.db');
    process.env.APP_USER_ID = '1';
    let db, server;
    t.after(async () => {
        server?.closeAllConnections();
        if (server) await new Promise(resolve => server.close(resolve));
        await db?.closePool();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('schedule-planning-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    db = await require('../../database')();
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'PLAN-TEST','Planning Tester','IT')");
    await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'PLAN-SUB','Planning Subject')");
    const router = require('../routes/thoikhoabieu');
    router.setDb(db);
    const app = express();
    app.use(express.json());
    app.use('/schedules', router);
    app.use(require('../middlewares/error').errorHandler);
    server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, endpoint, body) => {
        const response = await fetch(base + endpoint, {
            method, headers: { 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        return { status: response.status, body: await response.json() };
    };
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T09:30:00Z') });
    const study = { title: 'Future study', subjectId: 1, studyDate: '2026-11-05', startTime: '19:00', endTime: '20:00', notes: '' };

    for (const [date, start] of [['2026-11-03', '19:00'], ['2026-11-04', '09:00'], ['2026-11-04', '16:30']]) {
        await t.test(`rejects new self-study at ${date} ${start}`, async () => {
            const result = await request('POST', '/schedules/study', { ...study, studyDate: date, startTime: start });
            assert.equal(result.status, 400);
            assert.equal(result.body.success, false);
            assert.equal((await db.executeQuery('SELECT * FROM StudySchedules')).length, 0);
        });
    }

    let studyId;
    await t.test('persists a future session', async () => {
        const result = await request('POST', '/schedules/study', study);
        assert.equal(result.status, 201);
        studyId = result.body.data.schedule_id;
        assert.equal((await db.layLichTuHoc(1))[0].title, study.title);
    });
    await t.test('rejects rescheduling into the past without changing stored dates', async () => {
        assert.equal((await request('PUT', `/schedules/study/${studyId}`, { studyDate: '2026-11-03' })).status, 400);
        assert.equal((await db.layLichTuHoc(1))[0].study_date, '2026-11-05');
    });
    await t.test('creates a session later today', async () => {
        assert.equal((await request('POST', '/schedules/study', {
            ...study, studyDate: '2026-11-04', startTime: '17:00', endTime: '18:00'
        })).status, 201);
    });
    await t.test('rejects a past classroom lesson and allows a future lesson', async () => {
        const body = { subjectId: 1, className: 'PLAN-1', room: 'P.101', dayOfWeek: 5, startTime: '08:00', endTime: '09:00', startDate: '2026-11-03', endDate: '2026-11-03' };
        assert.equal((await request('POST', '/schedules', body)).status, 400);
        assert.equal((await db.executeQuery('SELECT * FROM Timetables')).length, 0);
        assert.equal((await request('POST', '/schedules', { ...body, startDate: '2026-11-05', endDate: '2026-11-05' })).status, 201);
    });

    let historicId;
    await t.test('allows editing historical notes with unchanged date and times', async () => {
        const row = await db.xepLichTuHoc(1, { ...study, title: 'History', studyDate: '2026-11-03' });
        historicId = row.schedule_id;
        const result = await request('PUT', `/schedules/study/${historicId}`, {
            ...study, studyDate: '2026-11-03', notes: 'Finished chapter 1'
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.data.notes, 'Finished chapter 1');
        assert.equal(result.body.data.study_date, '2026-11-03');
    });
    await t.test('rejects changing the time of historical sessions', async () => {
        assert.equal((await request('PUT', `/schedules/study/${historicId}`, { endTime: '21:00' })).status, 400);
        assert.equal((await request('PATCH', `/schedules/study/${historicId}/status`, { status: 'COMPLETED' })).status, 200);
    });
    await t.test('does not suggest elapsed free time today', async () => {
        const result = await request('GET', '/schedules/study/free-slots?date=2026-11-04&duration=15');
        assert.equal(result.status, 200);
        assert.equal(result.body.freeSlots[0].start_time, '16:31');
        assert.ok(result.body.freeSlots.every(slot => slot.start_time >= '16:31' && slot.duration_minutes >= 15));
        const longer = await request('GET', '/schedules/study/free-slots?date=2026-11-04&duration=60');
        assert.ok(longer.body.freeSlots.every(slot => slot.duration_minutes >= 60));
    });
    await t.test('rejects searching yesterday and respects the Vietnam midnight boundary', async () => {
        assert.equal((await request('GET', '/schedules/study/free-slots?date=2026-11-03&duration=60')).status, 400);
        t.mock.timers.setTime(new Date('2026-11-04T17:00:00Z').getTime());
        assert.equal((await request('POST', '/schedules/study', { ...study, studyDate: '2026-11-04' })).status, 400);
        assert.equal((await request('POST', '/schedules/study', { ...study, startTime: '07:00', endTime: '08:00' })).status, 201);
    });
});

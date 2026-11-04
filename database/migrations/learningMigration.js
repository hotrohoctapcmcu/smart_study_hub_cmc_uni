'use strict';

const { createHash } = require('node:crypto');
const { textOnlyChapters } = require('../shared/eduxContent');

function migrateLearning(db) {
    db.run(`
        CREATE TABLE IF NOT EXISTS LearningCourses (
            user_id INTEGER NOT NULL,
            course_id TEXT NOT NULL,
            subject_name TEXT NOT NULL,
            subject_code TEXT NOT NULL DEFAULT '',
            chapters_json TEXT NOT NULL DEFAULT '[]',
            source_hash TEXT NOT NULL,
            complete INTEGER NOT NULL DEFAULT 0,
            failures_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL,
            PRIMARY KEY(user_id, course_id)
        );
        CREATE TABLE IF NOT EXISTS LearningSummaries (
            user_id INTEGER NOT NULL,
            course_id TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            content TEXT NOT NULL,
            coverage_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, course_id)
        );
        CREATE TABLE IF NOT EXISTS LearningCards (
            user_id INTEGER NOT NULL,
            card_id TEXT NOT NULL,
            course_id TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            chapter TEXT NOT NULL DEFAULT '',
            source_ids_json TEXT NOT NULL,
            due_at TEXT NOT NULL,
            interval_days REAL NOT NULL DEFAULT 0,
            review_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, card_id)
        );
        CREATE INDEX IF NOT EXISTS IX_LearningCards_Course ON LearningCards(user_id, course_id, source_hash, due_at);
        CREATE TABLE IF NOT EXISTS LearningReviews (
            user_id INTEGER NOT NULL,
            request_id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            rating TEXT NOT NULL,
            result_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, request_id)
        );
        CREATE TABLE IF NOT EXISTS LearningSyncReports (
            user_id INTEGER PRIMARY KEY,
            failures_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS LearningCourseTexts (
            user_id INTEGER NOT NULL,
            course_id TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, course_id)
        );
        CREATE TABLE IF NOT EXISTS LearningSummaryParts (
            user_id INTEGER NOT NULL,
            course_id TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            part_key TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, course_id, input_hash, part_key)
        );
        CREATE TABLE IF NOT EXISTS LearningCardBatches (
            user_id INTEGER NOT NULL,
            course_id TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            summary_hash TEXT NOT NULL,
            batch_key TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id, course_id, source_hash, summary_hash, batch_key)
        );
    `);

    for (const [table, column, type] of [
        ['LearningSummaries', 'input_hash', "TEXT NOT NULL DEFAULT ''"],
        ['LearningSummaries', 'pipeline_version', 'INTEGER NOT NULL DEFAULT 1'],
        ['LearningSummaries', 'summary_hash', "TEXT NOT NULL DEFAULT ''"],
        ['LearningSummaries', 'format_json', "TEXT NOT NULL DEFAULT '{}'"],
        ['LearningSummaries', 'cards_state_json', "TEXT NOT NULL DEFAULT '{}'"],
        ['LearningCards', 'summary_hash', "TEXT NOT NULL DEFAULT ''"]
    ]) {
        const columns = db.exec(`PRAGMA table_info(${table})`)[0].values.map(row => row[1]);
        if (!columns.includes(column)) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }

    // Remove image payloads and references written by older versions as well.
    const rows = db.exec('SELECT user_id,course_id,chapters_json,complete FROM LearningCourses')[0]?.values || [];
    let cleanedUp = false;
    for (const [userId, courseId, stored, wasComplete] of rows) {
        let previous;
        try { previous = JSON.parse(stored); } catch { continue; }
        const chapters = textOnlyChapters(previous);
        const serialized = JSON.stringify(chapters);
        if (serialized === stored) continue;
        const documents = chapters.flatMap(chapter => chapter.documents || []);
        const complete = wasComplete && chapters.length > 0 && documents.length > 0 &&
            chapters.every(chapter => chapter.complete !== false) && documents.every(document => document.status === 'ready');
        const hash = createHash('sha256').update(JSON.stringify(chapters.map(chapter => [chapter.id, chapter.title,
            (chapter.documents || []).map(document => [document.id, document.title, document.number, document.rawContent ?? document.content])]))).digest('hex');
        db.run('UPDATE LearningCourses SET chapters_json=?,source_hash=?,complete=? WHERE user_id=? AND course_id=?',
            [serialized, hash, complete ? 1 : 0, userId, courseId]);
        cleanedUp = true;
    }
    if (cleanedUp) db.run('VACUUM');
}

module.exports = { migrateLearning };

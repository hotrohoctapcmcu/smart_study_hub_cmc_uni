PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS PomodoroSessions (
    session_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id          INTEGER NOT NULL,
    subject_id          INTEGER,
    schedule_id         INTEGER,

    focus_duration      INTEGER NOT NULL DEFAULT 25,
    break_duration      INTEGER NOT NULL DEFAULT 5,
    long_break_duration INTEGER NOT NULL DEFAULT 15,
    target_cycles       INTEGER NOT NULL DEFAULT 4,

    completed_cycles    INTEGER NOT NULL DEFAULT 0,
    total_focus_minutes INTEGER NOT NULL DEFAULT 0,
    total_break_minutes INTEGER NOT NULL DEFAULT 0,

    started_at          TEXT NOT NULL,
    ended_at            TEXT,
    session_date        TEXT NOT NULL,

    status              TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAUSED')),

    notes               TEXT,
    mood_rating         INTEGER CHECK (mood_rating IS NULL OR (mood_rating >= 1 AND mood_rating <= 5)),

    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL,
    FOREIGN KEY (schedule_id) REFERENCES StudySchedules(schedule_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Notebooks (
    notebook_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    subject_id      INTEGER,

    title           TEXT NOT NULL,
    description     TEXT,
    color           TEXT DEFAULT '#4A90D9',
    icon            TEXT DEFAULT '📒',
    is_archived     INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Notes (
    note_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id     INTEGER NOT NULL,
    student_id      INTEGER NOT NULL,

    chapter         TEXT,
    title           TEXT NOT NULL DEFAULT 'Ghi chú mới',
    content         TEXT,
    tags            TEXT,
    is_hard         INTEGER NOT NULL DEFAULT 0,
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (notebook_id) REFERENCES Notebooks(notebook_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS EduxDocuments (
    document_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    subject_id      INTEGER,

    external_id     TEXT,
    title           TEXT NOT NULL,
    description     TEXT,
    file_url        TEXT,
    file_type       TEXT,
    file_size       INTEGER,
    category        TEXT DEFAULT 'GENERAL'
                    CHECK (category IN ('LECTURE', 'ASSIGNMENT', 'EXAM', 'REFERENCE', 'GENERAL')),

    semester        TEXT,
    academic_year   TEXT,
    uploaded_by     TEXT,

    source          TEXT NOT NULL DEFAULT 'EDUX',
    synced_at       TEXT,
    is_deleted_on_source INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE (student_id, external_id),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS EduxSyncLog (
    sync_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,

    sync_type       TEXT NOT NULL DEFAULT 'FULL'
                    CHECK (sync_type IN ('FULL', 'INCREMENTAL', 'ROLLBACK')),
    status          TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                    CHECK (status IN ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK')),

    items_synced    INTEGER NOT NULL DEFAULT 0,
    items_failed    INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,

    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT,

    rollback_data   TEXT,

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_Pomodoro_Student_Date
    ON PomodoroSessions(student_id, session_date);
CREATE INDEX IF NOT EXISTS IX_Pomodoro_Student_Status
    ON PomodoroSessions(student_id, status);
CREATE INDEX IF NOT EXISTS IX_Pomodoro_Subject
    ON PomodoroSessions(subject_id, session_date);

CREATE INDEX IF NOT EXISTS IX_Notebooks_Student
    ON Notebooks(student_id, is_archived);
CREATE INDEX IF NOT EXISTS IX_Notebooks_Subject
    ON Notebooks(student_id, subject_id);
CREATE INDEX IF NOT EXISTS IX_Notes_Notebook
    ON Notes(notebook_id, sort_order);
CREATE INDEX IF NOT EXISTS IX_Notes_Student
    ON Notes(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS IX_Notes_Hard
    ON Notes(student_id, is_hard);
CREATE INDEX IF NOT EXISTS IX_Notes_Tags
    ON Notes(tags);

CREATE INDEX IF NOT EXISTS IX_Edux_Student_Subject
    ON EduxDocuments(student_id, subject_id);
CREATE INDEX IF NOT EXISTS IX_Edux_External
    ON EduxDocuments(external_id);
CREATE INDEX IF NOT EXISTS IX_Edux_Category
    ON EduxDocuments(student_id, category);

CREATE INDEX IF NOT EXISTS IX_EduxSync_Student
    ON EduxSyncLog(student_id, started_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_Notes_UpdateNotebook
    AFTER UPDATE ON Notes
    FOR EACH ROW
BEGIN
    UPDATE Notebooks
    SET updated_at = datetime('now')
    WHERE notebook_id = NEW.notebook_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_Pomodoro_AutoCalc
    AFTER UPDATE OF status ON PomodoroSessions
    WHEN NEW.status = 'COMPLETED' AND NEW.ended_at IS NOT NULL
BEGIN
    UPDATE PomodoroSessions
    SET total_focus_minutes = CASE
            WHEN NEW.total_focus_minutes > 0 THEN NEW.total_focus_minutes
            ELSE NEW.completed_cycles * NEW.focus_duration
        END,
        total_break_minutes = CASE
            WHEN NEW.total_break_minutes > 0 THEN NEW.total_break_minutes
            WHEN completed_cycles > 0
            THEN (completed_cycles - 1) * break_duration
            ELSE 0
        END,
        updated_at = datetime('now')
    WHERE session_id = NEW.session_id;
END;

-- ===================================================================================
-- DỰ ÁN HỖ TRỢ QUẢN LÝ HỌC TẬP - SPRINT 2
-- 01_sprint2_migration.sql
-- MIGRATION CẬP NHẬT CẤU TRÚC DATABASE CHO SPRINT 2
-- ===================================================================================
-- Nguyên tắc:
--   1. Không xóa / làm mất dữ liệu cũ (Sprint 1).
--   2. Dùng CREATE TABLE IF NOT EXISTS, ALTER TABLE kèm kiểm tra cột.
--   3. Không tạo bảng trùng chức năng với Sprint 1.
--   4. Đảm bảo FOREIGN KEY consistency, tất cả FK tham chiếu bảng hiện tại.
-- ===================================================================================

-- ─── PRAGMA ────────────────────────────────────────────────────────────────────
PRAGMA foreign_keys = ON;

-- ===================================================================================
-- PHẦN 1: BỔ SUNG CỘT CHO BẢNG HIỆN TẠI (PB-30, PB-32)
-- ===================================================================================

-- 1a. Bảng Exams: bổ sung semester và academic_year nếu chưa có
--     (SQLite không hỗ trợ ADD COLUMN IF NOT EXISTS, xử lý bằng JS migration)
--     → Cột này sẽ được thêm qua script migration JS để kiểm tra trước.

-- 1b. Bảng Grades: đã có component_score, exam_score từ Sprint 1 → OK

-- ===================================================================================
-- PHẦN 2: BẢNG POMODORO SESSIONS (PB-42)
-- ===================================================================================
-- Lưu lịch sử từng phiên Pomodoro (focus + break).
-- Hỗ trợ truy vấn theo student_id, ngày học, và subject_id.

CREATE TABLE IF NOT EXISTS PomodoroSessions (
    session_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id          INTEGER NOT NULL,
    subject_id          INTEGER,
    schedule_id         INTEGER,           -- Liên kết với buổi tự học (nếu có)

    -- Cấu hình phiên Pomodoro
    focus_duration      INTEGER NOT NULL DEFAULT 25,   -- phút focus
    break_duration      INTEGER NOT NULL DEFAULT 5,    -- phút nghỉ ngắn
    long_break_duration INTEGER NOT NULL DEFAULT 15,   -- phút nghỉ dài
    target_cycles       INTEGER NOT NULL DEFAULT 4,    -- số chu kỳ mục tiêu

    -- Kết quả thực tế
    completed_cycles    INTEGER NOT NULL DEFAULT 0,    -- số chu kỳ hoàn thành
    total_focus_minutes INTEGER NOT NULL DEFAULT 0,    -- tổng phút tập trung thực tế
    total_break_minutes INTEGER NOT NULL DEFAULT 0,    -- tổng phút nghỉ thực tế

    -- Thời gian
    started_at          TEXT NOT NULL,                 -- ISO 8601
    ended_at            TEXT,                          -- NULL nếu đang chạy
    session_date        TEXT NOT NULL,                 -- YYYY-MM-DD, để query theo ngày

    -- Trạng thái
    status              TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAUSED')),

    -- Ghi chú
    notes               TEXT,
    mood_rating         INTEGER CHECK (mood_rating IS NULL OR (mood_rating >= 1 AND mood_rating <= 5)),

    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL,
    FOREIGN KEY (schedule_id) REFERENCES StudySchedules(schedule_id) ON DELETE SET NULL
);

-- ===================================================================================
-- PHẦN 3: BẢNG NOTEBOOKS VÀ NOTES (PB-38)
-- ===================================================================================
-- Sổ tay theo môn học, ghi chú theo chương.

CREATE TABLE IF NOT EXISTS Notebooks (
    notebook_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    subject_id      INTEGER,               -- Liên kết môn học (tùy chọn)

    title           TEXT NOT NULL,          -- Tên sổ tay
    description     TEXT,
    color           TEXT DEFAULT '#4A90D9', -- Màu hiển thị
    icon            TEXT DEFAULT '📒',      -- Icon hiển thị
    is_archived     INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Notes (
    note_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id     INTEGER NOT NULL,
    student_id      INTEGER NOT NULL,      -- Quyền sở hữu (truy vấn nhanh)

    chapter         TEXT,                   -- Chương / phần
    title           TEXT NOT NULL DEFAULT 'Ghi chú mới',
    content         TEXT,                   -- Nội dung ghi chú (Markdown / text)
    tags            TEXT,                   -- JSON array: ["tag1", "tag2"]
    is_hard         INTEGER NOT NULL DEFAULT 0,  -- Đánh dấu "khó" để ôn lại
    is_favorite     INTEGER NOT NULL DEFAULT 0,  -- Đánh dấu yêu thích
    sort_order      INTEGER NOT NULL DEFAULT 0,  -- Thứ tự sắp xếp trong notebook

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (notebook_id) REFERENCES Notebooks(notebook_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
);

-- ===================================================================================
-- PHẦN 4: BẢNG TÀI LIỆU EDUX (PB-05, PB-06)
-- ===================================================================================
-- Lưu tài liệu đồng bộ từ EDUX (LMS), giữ dữ liệu bền vững khi nguồn lỗi.

CREATE TABLE IF NOT EXISTS EduxDocuments (
    document_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    subject_id      INTEGER,

    external_id     TEXT,                   -- ID trên EDUX (dùng để upsert)
    title           TEXT NOT NULL,
    description     TEXT,
    file_url        TEXT,                   -- URL tải file trên EDUX
    file_type       TEXT,                   -- pdf, docx, pptx, zip...
    file_size       INTEGER,               -- byte
    category        TEXT DEFAULT 'GENERAL'
                    CHECK (category IN ('LECTURE', 'ASSIGNMENT', 'EXAM', 'REFERENCE', 'GENERAL')),

    semester        TEXT,
    academic_year   TEXT,
    uploaded_by     TEXT,                   -- Tên giảng viên upload

    -- Đồng bộ
    source          TEXT NOT NULL DEFAULT 'EDUX',
    synced_at       TEXT,                   -- Lần đồng bộ gần nhất
    is_deleted_on_source INTEGER NOT NULL DEFAULT 0, -- File bị xóa trên EDUX nhưng giữ local

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE (student_id, external_id),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL
);

-- Log đồng bộ EDUX (hỗ trợ rollback và audit)
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

    -- Snapshot dữ liệu trước đồng bộ (JSON) để rollback
    rollback_data   TEXT,

    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
);

-- ===================================================================================
-- PHẦN 5: INDEX CHO CÁC BẢNG MỚI
-- ===================================================================================

-- PomodoroSessions
CREATE INDEX IF NOT EXISTS IX_Pomodoro_Student_Date
    ON PomodoroSessions(student_id, session_date);
CREATE INDEX IF NOT EXISTS IX_Pomodoro_Student_Status
    ON PomodoroSessions(student_id, status);
CREATE INDEX IF NOT EXISTS IX_Pomodoro_Subject
    ON PomodoroSessions(subject_id, session_date);

-- Notebooks & Notes
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

-- EduxDocuments
CREATE INDEX IF NOT EXISTS IX_Edux_Student_Subject
    ON EduxDocuments(student_id, subject_id);
CREATE INDEX IF NOT EXISTS IX_Edux_External
    ON EduxDocuments(external_id);
CREATE INDEX IF NOT EXISTS IX_Edux_Category
    ON EduxDocuments(student_id, category);

-- EduxSyncLog
CREATE INDEX IF NOT EXISTS IX_EduxSync_Student
    ON EduxSyncLog(student_id, started_at DESC);

-- ===================================================================================
-- PHẦN 6: TRIGGER CẬP NHẬT UPDATED_AT TỰ ĐỘNG
-- ===================================================================================

-- Notebooks: tự cập nhật updated_at khi bất kỳ note nào thay đổi
CREATE TRIGGER IF NOT EXISTS trg_Notes_UpdateNotebook
    AFTER UPDATE ON Notes
    FOR EACH ROW
BEGIN
    UPDATE Notebooks
    SET updated_at = datetime('now')
    WHERE notebook_id = NEW.notebook_id;
END;

-- PomodoroSessions: tính lại total_focus_minutes khi kết thúc
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

-- ===================================================================================
-- KẾT THÚC MIGRATION SPRINT 2
-- ===================================================================================

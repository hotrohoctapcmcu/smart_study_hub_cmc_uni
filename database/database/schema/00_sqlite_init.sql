-- ===================================================================================
-- DỰ ÁN HỖ TRỢ QUẢN LÝ HỌC TẬP - SPRINT 1
-- 00_sqlite_init.sql
-- TẠO TOÀN BỘ CẤU TRÚC BẢNG CHO SQLITE (THAY THẾ SQL SERVER)
-- PHỤC VỤ CÁC CHỨC NĂNG: 1, 2, 3, 4, 9, 18
-- Lưu ý: Bỏ bảng Users và thuộc tính user_id — hệ thống chỉ dùng student_id
-- ===================================================================================

-- Chức năng 18: Hồ sơ học tập cá nhân

CREATE TABLE IF NOT EXISTS Students (
    student_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    student_code     TEXT    NOT NULL UNIQUE,
    full_name        TEXT    NOT NULL,
    major            TEXT    NOT NULL,
    dob              TEXT,
    enrollment_year  INTEGER,
    current_semester TEXT,
    phone            TEXT,
    avatar_url       TEXT,
    email            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Subjects (
    subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT NOT NULL UNIQUE,
    subject_name TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 3 CHECK (credits > 0 AND credits <= 15),
    description TEXT,
    department TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS StudentSubjects (
    student_subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'STUDYING', 'PLANNED', 'DROPPED')),
    academic_year TEXT,
    semester TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, subject_id, semester, academic_year),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Grades (
    grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    credits INTEGER NOT NULL,
    component_score REAL,
    exam_score REAL,
    final_score REAL NOT NULL CHECK (final_score >= 0.0 AND final_score <= 10.0),
    letter_grade TEXT NOT NULL CHECK (letter_grade IN ('A+','A','B+','B','C+','C','D+','D','F')),
    total_points REAL,
    is_passed INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'IU',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, subject_id, semester, academic_year, attempt_number),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE
);

-- Chức năng 1: Thời khóa biểu thông minh

CREATE TABLE IF NOT EXISTS Timetables (
    timetable_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    room TEXT NOT NULL,
    campus TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 2 AND 8),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    lecturer_name TEXT,
    semester TEXT,
    academic_year TEXT,
    source TEXT NOT NULL DEFAULT 'IU',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_time > start_time),
    CHECK (end_date >= start_date),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE
);

-- Chức năng 2: AI xếp lịch tự học & cảnh báo trùng

CREATE TABLE IF NOT EXISTS StudySchedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER,
    title TEXT NOT NULL,
    study_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_ai_suggested INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_time > start_time),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE SET NULL
);

-- Chức năng 3: Quản lý Deadline và Checklist

CREATE TABLE IF NOT EXISTS Assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_at TEXT,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','OVERDUE')),
    submission_url TEXT,
    source TEXT NOT NULL DEFAULT 'LMS' CHECK (source IN ('LMS','TEACHER','SYSTEM','IU')),
    external_id TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Checklists (
    checklist_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER,
    assignment_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    deadline TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE NO ACTION,
    FOREIGN KEY (assignment_id) REFERENCES Assignments(assignment_id) ON DELETE NO ACTION
);

-- Chức năng 4: Nhắc nhở thông minh đa tầng

-- UNIQUE (student_id, target_type, target_id, tier) tránh bản ghi nhắc nhở bị trùng
CREATE TABLE IF NOT EXISTS Reminders (
    reminder_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL,
    target_type TEXT    NOT NULL CHECK (target_type IN ('ASSIGNMENT','EXAM','LESSON','STUDY_PLAN','CUSTOM')),
    target_id   INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    message     TEXT,
    tier        TEXT    NOT NULL CHECK (tier IN ('7_DAYS','3_DAYS','24_HOURS','12_HOURS','1_HOUR','OVERDUE','CUSTOM')),
    remind_time TEXT    NOT NULL,
    is_sent     INTEGER NOT NULL DEFAULT 0,
    sent_at     TEXT,
    channel     TEXT    NOT NULL DEFAULT 'APP' CHECK (channel IN ('APP','EMAIL','NOTIFICATION')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, target_type, target_id, tier),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
);

-- Chức năng 9: Quản lý lịch thi và kế hoạch ôn thi

CREATE TABLE IF NOT EXISTS Exams (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    exam_name TEXT NOT NULL DEFAULT 'Thi kết thúc học phần',
    exam_date TEXT NOT NULL,
    exam_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    room TEXT NOT NULL,
    campus TEXT NOT NULL,
    exam_format TEXT NOT NULL DEFAULT 'Tự luận',
    identification_number TEXT,
    source TEXT NOT NULL DEFAULT 'IU',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, subject_id, exam_date, exam_time),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ExamStudyPlans (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    target_description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'HIGH' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_date >= start_date),
    FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES Exams(exam_id) ON DELETE NO ACTION,
    FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE NO ACTION
);

-- Index cho hiệu năng truy vấn
CREATE INDEX IF NOT EXISTS IX_Students_StudentCode ON Students(student_code);
CREATE INDEX IF NOT EXISTS IX_Grades_Student_Semester ON Grades(student_id, semester);
CREATE INDEX IF NOT EXISTS IX_Timetables_Student_Day ON Timetables(student_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS IX_StudySchedules_Student_Date ON StudySchedules(student_id, study_date, start_time);
CREATE INDEX IF NOT EXISTS IX_Assignments_Student_Deadline ON Assignments(student_id, deadline);
CREATE INDEX IF NOT EXISTS IX_Reminders_Pending ON Reminders(student_id, is_sent, remind_time);
CREATE INDEX IF NOT EXISTS IX_Exams_Student_Date ON Exams(student_id, exam_date, exam_time);

-- KẾT THÚC TẠO CẤU TRÚC SQLITE
-- ===================================================================================

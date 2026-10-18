"use strict";

const { executeQuery } = require("../connection/db");

const VALID_GRADES = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];

async function saveIUData(userId, dataIU) {
    if (!userId) throw new Error("userId là bắt buộc");
    if (!dataIU) throw new Error("dataIU là bắt buộc");

    const result = {
        student: false,
        gradesCount: 0,
        timetableCount: 0,
        examsCount: 0,
        subjectsCount: 0
    };

    try {
        const uid = parseInt(userId, 10);

        if (!Number.isInteger(uid) || uid <= 0) {
            throw new Error("userId không hợp lệ");
        }

        await executeQuery(
            `INSERT INTO Users (
                user_id, username, password_hash, full_name, role, is_active
            )
            VALUES (@uid, @un, @pw, @fn, 'student', 1)
            ON CONFLICT(user_id) DO NOTHING`,
            {
                uid,
                un: `sv_${uid}`,
                pw: "",
                fn: dataIU.ho_ten || `Sinh viên ${uid}`
            }
        );

        const studentRows = await executeQuery(
            `SELECT student_id
             FROM Students
             WHERE user_id = @uid OR student_id = @uid
             LIMIT 1`,
            { uid }
        );

        let studentId = studentRows.length
            ? studentRows[0].student_id
            : null;

        // 1. Đồng bộ hồ sơ sinh viên
        if (dataIU.MSV || dataIU.ten_nganh_hoc) {
            const dob = dataIU.ngay_thang_nam_sinh
                ? convertDate(dataIU.ngay_thang_nam_sinh)
                : null;

            if (studentId) {
                await executeQuery(
                    `UPDATE Students
                     SET student_code = @sc,
                         full_name = @fn,
                         major = @mj,
                         dob = COALESCE(@db, dob),
                         enrollment_year = COALESCE(@ey, enrollment_year),
                         current_semester = COALESCE(@cs, current_semester),
                         updated_at = datetime('now')
                     WHERE student_id = @sid`,
                    {
                        sc: dataIU.MSV || "CMC123456",
                        fn: dataIU.ho_ten || "Sinh viên CMC",
                        mj: dataIU.ten_nganh_hoc || "Công nghệ thông tin",
                        db: dob,
                        ey: 2023,
                        cs: "Học kỳ 1 - 2026",
                        sid: studentId
                    }
                );
            } else {
                await executeQuery(
                    `INSERT INTO Students (
                        user_id, student_code, full_name, major, dob,
                        enrollment_year, current_semester, phone, avatar_url
                    )
                    VALUES (
                        @uid, @sc, @fn, @mj, @db,
                        @ey, @cs, NULL, NULL
                    )`,
                    {
                        uid,
                        sc: dataIU.MSV || "CMC123456",
                        fn: dataIU.ho_ten || "Sinh viên CMC",
                        mj: dataIU.ten_nganh_hoc || "Công nghệ thông tin",
                        db: dob,
                        ey: 2023,
                        cs: "Học kỳ 1 - 2026"
                    }
                );

                const newStudent = await executeQuery(
                    "SELECT student_id FROM Students WHERE user_id = @uid",
                    { uid }
                );

                studentId = newStudent.length
                    ? newStudent[0].student_id
                    : null;
            }

            if (dataIU.ho_ten) {
                await executeQuery(
                    `UPDATE Users
                     SET full_name = @fn, updated_at = datetime('now')
                     WHERE user_id = @uid`,
                    { fn: dataIU.ho_ten, uid }
                );
            }

            result.student = true;
        }

        // 2. Đồng bộ môn học và bảng điểm
        if (
            dataIU.bang_diem &&
            typeof dataIU.bang_diem === "object" &&
            !Array.isArray(dataIU.bang_diem)
        ) {
            for (const [kyKey, monList] of Object.entries(dataIU.bang_diem)) {
                if (
                    !monList ||
                    typeof monList !== "object" ||
                    Array.isArray(monList)
                ) {
                    continue;
                }

                for (const [tenMon, chiTiet] of Object.entries(monList)) {
                    if (!chiTiet || typeof chiTiet !== "object") {
                        continue;
                    }

                    const cleanName = tenMon.replace(/_/g, " ").trim();

                    if (!cleanName) continue;

                    const credits = Number(chiTiet.so_tin_chi) || 3;
                    const rawScore = chiTiet.diem_tong_ket;
                    const finalScore =
                        rawScore === "" ||
                        rawScore === null ||
                        rawScore === undefined
                            ? null
                            : Number(rawScore);

                    const rawLetter = String(chiTiet.diem_chu ?? "")
                        .trim()
                        .toUpperCase();

                    const letter = VALID_GRADES.includes(rawLetter)
                        ? rawLetter
                        : null;

                    const isPassed =
                        String(chiTiet.trang_thai || "")
                            .trim()
                            .toLowerCase() === "dat"
                            ? 1
                            : 0;

                    if (
                        finalScore !== null &&
                        !Number.isFinite(finalScore)
                    ) {
                        console.warn(
                            `[SYNC] Điểm số không hợp lệ: ${cleanName}`,
                            rawScore
                        );
                    }

                    // Không lưu bản ghi điểm nếu điểm chữ vi phạm CHECK.
                    // Bỏ qua môn này để không làm hỏng toàn bộ lần đồng bộ.
                    if (!letter) {
                        console.warn(
                            `[SYNC] Bỏ qua điểm môn "${cleanName}", kỳ "${kyKey}": ` +
                            `điểm chữ IU không hợp lệ ${JSON.stringify(rawLetter)}`
                        );
                        continue;
                    }

                    if (
                        finalScore !== null &&
                        !Number.isFinite(finalScore)
                    ) {
                        continue;
                    }

                    let subRows = await executeQuery(
                        `SELECT subject_id
                         FROM Subjects
                         WHERE subject_name = @name
                         LIMIT 1`,
                        { name: cleanName }
                    );

                    let subjectId;

                    if (subRows.length) {
                        subjectId = subRows[0].subject_id;
                    } else {
                        const code =
                            "SUB_" + Math.abs(hashCode(cleanName));

                        await executeQuery(
                            `INSERT INTO Subjects (
                                subject_code, subject_name, credits
                            )
                            VALUES (@code, @name, @credits)`,
                            {
                                code,
                                name: cleanName,
                                credits
                            }
                        );

                        const idRows = await executeQuery(
                            `SELECT subject_id
                             FROM Subjects
                             WHERE subject_code = @code
                             LIMIT 1`,
                            { code }
                        );

                        subjectId = idRows.length
                            ? idRows[0].subject_id
                            : null;

                        if (subjectId) result.subjectsCount++;
                    }

                    if (!studentId || !subjectId) continue;

                    const gradeParams = {
                        sid: studentId,
                        subId: subjectId,
                        sem: kyKey,
                        ay: "",
                        cr: credits,
                        fs: finalScore,
                        lg: letter,
                        ip: isPassed
                    };

                    const exist = await executeQuery(
                        `SELECT 1
                         FROM Grades
                         WHERE student_id = @sid
                           AND subject_id = @subId
                           AND semester = @sem
                           AND academic_year = @ay
                         LIMIT 1`,
                        gradeParams
                    );

                    if (exist.length) {
                        await executeQuery(
                            `UPDATE Grades
                             SET final_score = @fs,
                                 letter_grade = @lg,
                                 is_passed = @ip,
                                 updated_at = datetime('now')
                             WHERE student_id = @sid
                               AND subject_id = @subId
                               AND semester = @sem
                               AND academic_year = @ay`,
                            gradeParams
                        );
                    } else {
                        await executeQuery(
                            `INSERT INTO Grades (
                                student_id, subject_id, semester, academic_year,
                                credits, final_score, letter_grade, is_passed, source
                            )
                            VALUES (
                                @sid, @subId, @sem, @ay,
                                @cr, @fs, @lg, @ip, 'IU'
                            )`,
                            gradeParams
                        );
                    }

                    result.gradesCount++;
                }
            }
        }

        // 3. Đồng bộ thời khóa biểu
        if (Array.isArray(dataIU.tkb)) {
            if (studentId && dataIU.tkb.length > 0) {
                await executeQuery(
                    `DELETE FROM Timetables
                     WHERE student_id = @sid AND source = 'IU'`,
                    { sid: studentId }
                );
            }

            for (const t of dataIU.tkb) {
                if (!t || typeof t !== "object") continue;

                const subjectName = (t.ten_mon || "")
                    .replace(/_/g, " ")
                    .trim();

                const subjectCode = t.ma_mon || "UNKNOWN";

                let subRows = await executeQuery(
                    `SELECT subject_id
                     FROM Subjects
                     WHERE subject_code = @code OR subject_name = @name
                     LIMIT 1`,
                    {
                        code: subjectCode,
                        name: subjectName
                    }
                );

                let subjectId = subRows.length
                    ? subRows[0].subject_id
                    : null;

                if (!subjectId && subjectName) {
                    const code =
                        t.ma_mon || `MON_${Math.abs(hashCode(subjectName))}`;

                    await executeQuery(
                        `INSERT INTO Subjects (
                            subject_code, subject_name, credits
                        )
                        VALUES (@code, @name, 3)`,
                        {
                            code,
                            name: subjectName
                        }
                    );

                    const idRows = await executeQuery(
                        `SELECT subject_id
                         FROM Subjects
                         WHERE subject_code = @code
                         LIMIT 1`,
                        { code }
                    );

                    subjectId = idRows.length
                        ? idRows[0].subject_id
                        : null;

                    if (subjectId) result.subjectsCount++;
                }

                if (!studentId || !subjectId) continue;

                await executeQuery(
                    `INSERT INTO Timetables (
                        student_id, subject_id, class_name, room, campus,
                        day_of_week, start_time, end_time, start_date, end_date,
                        lecturer_name, source
                    )
                    VALUES (
                        @sid, @subId, @cn, @rm, @cp,
                        @dow, @st, @et, @sd, @ed, @ln, 'IU'
                    )`,
                    {
                        sid: studentId,
                        subId: subjectId,
                        cn: t.ten_lop || "Lớp học phần",
                        rm: t.phong || "A101",
                        cp: t.co_so || "Cơ sở chính",
                        dow: Number(t.thu) || 2,
                        st: t.gio_bat_dau || "07:30",
                        et: t.gio_ket_thuc || "09:30",
                        sd: convertDate(t.ngay_bat_dau) || "2026-09-01",
                        ed: convertDate(t.ngay_ket_thuc) || "2026-12-31",
                        ln: t.giang_vien || null
                    }
                );

                result.timetableCount++;
            }
        }

        // 4. Đồng bộ lịch thi
        if (Array.isArray(dataIU.lich_thi)) {
            if (studentId && dataIU.lich_thi.length > 0) {
                await executeQuery(
                    `DELETE FROM Exams
                     WHERE student_id = @sid AND source = 'IU'`,
                    { sid: studentId }
                );
            }

            for (const lt of dataIU.lich_thi) {
                if (!lt || typeof lt !== "object") continue;

                const subjectName = (lt.ten_mon || "")
                    .replace(/_/g, " ")
                    .trim();

                const subjectCode = lt.ma_mon || "UNKNOWN";

                let subRows = await executeQuery(
                    `SELECT subject_id
                     FROM Subjects
                     WHERE subject_code = @code OR subject_name = @name
                     LIMIT 1`,
                    {
                        code: subjectCode,
                        name: subjectName
                    }
                );

                let subjectId = subRows.length
                    ? subRows[0].subject_id
                    : null;

                if (!subjectId && subjectName) {
                    const code =
                        lt.ma_mon || `MON_${Math.abs(hashCode(subjectName))}`;

                    await executeQuery(
                        `INSERT INTO Subjects (
                            subject_code, subject_name, credits
                        )
                        VALUES (@code, @name, 3)`,
                        {
                            code,
                            name: subjectName
                        }
                    );

                    const idRows = await executeQuery(
                        `SELECT subject_id
                         FROM Subjects
                         WHERE subject_code = @code
                         LIMIT 1`,
                        { code }
                    );

                    subjectId = idRows.length
                        ? idRows[0].subject_id
                        : null;

                    if (subjectId) result.subjectsCount++;
                }

                if (!studentId || !subjectId) continue;

                await executeQuery(
                    `INSERT INTO Exams (
                        student_id, subject_id, exam_name, exam_date, exam_time,
                        duration_minutes, room, campus, exam_format, source
                    )
                    VALUES (
                        @sid, @subId, @name, @ed, @et,
                        90, @rm, @cp, 'Tự luận', 'IU'
                    )`,
                    {
                        sid: studentId,
                        subId: subjectId,
                        name: "Thi kết thúc học phần",
                        ed: convertDate(lt.ngay_thi) || "2026-12-15",
                        et: lt.gio_thi || "08:00",
                        rm: lt.phong_thi || "A201",
                        cp: lt.co_so || "Cơ sở chính"
                    }
                );

                result.examsCount++;
            }
        }

        console.log("[SYNC] Đồng bộ IU hoàn tất:", result);

        return result;
    } catch (err) {
        console.error("[SYNC] Lỗi đồng bộ IU:", err.message);
        throw err;
    }
}

function convertDate(dateStr) {
    if (!dateStr) return null;

    const value = String(dateStr).trim();
    const parts = value.split("/");

    if (parts.length === 3) {
        const [day, month, year] = parts;

        if (
            /^\d{1,2}$/.test(day) &&
            /^\d{1,2}$/.test(month) &&
            /^\d{4}$/.test(year)
        ) {
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
    }

    return value;
}

function hashCode(str) {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return hash;
}

module.exports = { saveIUData };
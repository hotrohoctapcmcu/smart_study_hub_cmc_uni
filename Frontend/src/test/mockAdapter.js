import * as fixture from "./fixtures";
import { formatDateISO, addDays, minutes } from "../utils/date";
import { mockPdf, mockDocx } from "./mockFiles";
const clone = (value) => structuredClone(value);
const db = {
  profile: clone(fixture.mockProfile),
  tasks: clone(fixture.mockTasks),
  schedules: clone(fixture.mockSchedules),
  study: clone(fixture.mockStudySchedules),
  documents: clone(fixture.mockDocuments),
  notes: clone(fixture.mockNotes),
  notebooks: clone(fixture.mockNotebooks),
  exams: clone(fixture.mockExams),
  notifications: clone(fixture.mockNotifications),
  emails: clone(fixture.mockEmails),
  courses: clone(fixture.mockCourses),
  edux: clone(fixture.mockEduxTasks),
  quizzes: clone(fixture.mockQuizzes),
  conversations: [],
  plans: [],
  sessions: [],
  checklists: [
    {
      checklist_id: 1,
      assignment_id: 1,
      title: "Đọc lại lý thuyết chương 3",
      is_completed: 0,
    },
  ],
  weaknesses: [],
  connections: { iu: true, edux: true, outlook: true },
  files: new Map(),
};
let sequence = 100;
const syncJobs = new Map();
let latestSyncJob = null;
const syncTimes = {};
function subject(id) {
  return (
    fixture.mockSubjects.find((s) => String(s.subject_id) === String(id)) || {}
  );
}
function normalize(body) {
  const result = { ...body };
  for (const [camel, snake] of Object.entries({
    subjectId: "subject_id",
    studyDate: "study_date",
    startTime: "start_time",
    endTime: "end_time",
    className: "class_name",
    examDate: "exam_date",
    examId: "exam_id",
    examTime: "exam_time",
    phaseTitle: "phase_title",
    startDate: "start_date",
    endDate: "end_date",
    fullName: "full_name",
    studentCode: "student_code",
  })) {
    if (camel in body) {
      result[snake] = body[camel];
      delete result[camel];
    }
  }
  if ("subject_id" in result) Object.assign(result, subject(result.subject_id));
  return result;
}
function fail(config, message, status = 404) {
  const error = new Error(message);
  error.response = { status, data: { success: false, message }, config };
  throw error;
}
function range(rows, p, key = "study_date") {
  return rows.filter(
    (r) =>
      (!p.from || r[key] >= p.from) &&
      (!p.to || r[key] <= p.to) &&
      (!p.date || r[key] === p.date),
  );
}
function idOf(r) {
  return (
    r.id ??
    r.assignment_id ??
    r.timetable_id ??
    r.schedule_id ??
    r.exam_id ??
    r.notification_id ??
    r.checklist_id
  );
}
export async function mockAdapter(config) {
  await new Promise((r) => setTimeout(r, 180));
  const method = config.method.toLowerCase(),
    // AI resource fixtures use storage keys without their backend mount prefix.
    path = config.url.split("?")[0].replace(/^\/ai\/(quizzes|weaknesses)(?=\/|$)/, "/$1"),
    parts = path.split("/").filter(Boolean),
    p = config.params || {};
  let body = config.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const requireFields = (...fields) => {
    if (
      fields.some(
        (field) =>
          body[field] === undefined ||
          body[field] === null ||
          body[field] === "",
      )
    )
      fail(config, "Thiếu trường bắt buộc: " + fields.join(", "), 400);
  };
  if (method === "post") {
    if (path === "/tasks") requireFields("subjectId", "title", "deadline");
    if (path === "/exams")
      requireFields("subjectId", "examDate", "examTime", "room");
    if (path === "/exams/study-plans")
      requireFields("examId", "phaseTitle", "startDate", "endDate");
    if (path === "/ai/ask") requireFields("question");
    if (path === "/ai/plan") requireFields("startDate", "endDate");
    if (path === "/ai/check") requireFields("question", "answer");
    if (path === "/ai/draft-leave") requireFields("date", "reason");
    if (path === "/quizzes") requireFields("subject", "topic");
    if (path === "/pomodoro")
      requireFields("id", "startTime", "actualStudySeconds", "focusSegments");
    if (path.endsWith("/confirm") && body.confirmed !== true)
      fail(config, "Cần xác nhận kế hoạch.", 400);
  }
  const isGet = method === "get",
    isPost = method === "post";
  let data,
    meta = {};
  const ok = (value) => {
    data = value;
  };
  if (path === "/health") ok({ status: "online" });
  else if (path === "/dashboard")
    ok({
      profile: db.profile,
      todaySchedules: db.schedules.filter(
        (s) => s.study_date === formatDateISO(),
      ),
      upcomingDeadlines: db.tasks
        .filter((t) => t.status !== "COMPLETED")
        .slice(0, 4),
      upcomingExams: db.exams,
      unreadRemindersCount: db.notifications.filter((n) => !n.is_read).length,
    });
  else if (path === "/student/profile") {
    if (method === "put") db.profile = { ...db.profile, ...normalize(body) };
    ok(db.profile);
  } else if (path === "/student/subjects") ok(fixture.mockSubjects);
  else if (path === "/student/grades")
    ok(
      fixture.mockSubjects
        .map((s, i) => ({
          ...s,
          grade_id: i + 1,
          final_score: [8.5, 8, 9, 7.5][i],
          letter_grade: "A",
          semester: "HK1",
        }))
        .filter((r) => !p.hocKy || r.semester === p.hocKy),
    );
  else if (path === "/progress") ok(fixture.mockProgress);
  else if (path === "/timemap")
    ok({
      activities: db.sessions.map((s) => ({ ...s, date: s.created_at })),
      scope: {},
    });
  else if (path === "/search") {
    const q = String(p.q || "").trim().toLocaleLowerCase("vi");
    const wantedTag = String(p.tag || "").trim().replace(/^#/, "").toLocaleLowerCase("vi");
    const results = [];
    const add = (type, id, title, content, tags = [], route, detail = {}) => {
      const normalizedTags = Array.isArray(tags) ? tags : [];
      const preview = String(content || "").trim();
      const haystack = `${title} ${preview} ${normalizedTags.join(" ")}`.toLocaleLowerCase("vi");
      if ((q || wantedTag) && (!q || haystack.includes(q.replace(/^#/, ""))) && (!wantedTag || normalizedTags.some(tag => String(tag).toLocaleLowerCase("vi") === wantedTag))) {
        results.push({ type, id: String(id), title, preview: preview.slice(0, 160), tags: normalizedTags, route, ...detail });
      }
    };
    db.documents.forEach(row => add("document", row.id, row.title, row.subject, row.tags, "documents", { docTab: "docs" }));
    db.notes.forEach(row => add("note", row.id, row.title, `${row.subject || ""} ${row.chapter || ""} ${row.content || ""}`, row.tags, "documents", { docTab: "notes" }));
    db.tasks.forEach(row => add("task", row.assignment_id, row.title, row.description, row.tags, "tasks"));
    db.edux.forEach(row => add("task", row.id, row.title, `${row.subject || ""} ${row.description || ""}`, row.tags, "tasks"));
    db.study.forEach(row => add("schedule", row.schedule_id, row.title, `${row.study_date} ${row.notes || ""}`, [], "schedule", { selectedDate: row.study_date }));
    db.schedules.forEach(row => add("schedule", `class-${row.timetable_id}`, row.subject_name, `${row.class_name || ""} ${row.room || ""} ${row.study_date} ${row.start_time}`, [], "schedule", { selectedDate: row.study_date }));
    db.exams.forEach(row => add("exam", row.exam_id, row.subject_name, `${row.exam_name || ""} ${row.exam_date}`, [], "exams"));
    db.emails.forEach(row => add("email", row.id, row.subject, row.body, [], "school-email"));
    ok(results.slice(0, 100));
  } else if (path === "/schedules/conflicts/check") {
    const rows = [...db.schedules, ...db.study].filter(
      (r) =>
        r.study_date === body.studyDate &&
        String(idOf(r)) !== String(body.excludeScheduleId) &&
        minutes(r.start_time) < minutes(body.endTime) &&
        minutes(r.end_time) > minutes(body.startTime),
    );
    meta = { hasConflict: rows.length > 0, conflicts: rows };
    data = undefined;
  } else if (path === "/schedules/study/free-slots") {
    const rows = [...db.schedules, ...db.study].filter(
        (s) => s.study_date === p.date,
      ),
      duration = Number(p.duration) || 60,
      freeSlots = [];
    for (let start = 420; start + duration <= 1320; start += 30) {
      if (
        rows.every(
          (s) =>
            start + duration <= minutes(s.start_time) ||
            start >= minutes(s.end_time),
        )
      ) {
        const time = (m) =>
          String(Math.floor(m / 60)).padStart(2, "0") +
          ":" +
          String(m % 60).padStart(2, "0");
        freeSlots.push({
          startTime: time(start),
          endTime: time(start + duration),
        });
      }
    }
    meta = { date: p.date, freeSlots };
    data = undefined;
  } else if (path === "/schedules/today") {
    ok(db.schedules.filter((s) => s.study_date === formatDateISO()));
    meta.date = formatDateISO();
  } else if (path === "/schedules/by-date") {
    ok(range(db.schedules, p));
    meta.date = p.date;
  } else if (path === "/schedules/by-week") {
    ok(range(db.schedules, p));
    meta = { from: p.from, to: p.to };
  } else if (path === "/tasks/upcoming")
    ok(
      db.tasks.filter(
        (t) =>
          t.status !== "COMPLETED" &&
          t.deadline >= formatDateISO() &&
          t.deadline <=
            formatDateISO(addDays(new Date(), Number(p.days) || 3)) + "T23:59",
      ),
    );
  else if (path === "/tasks/edux" && isGet)
    ok({
      source: "EDUX",
      cached: true,
      assignments: db.edux,
      total: db.edux.length,
    });
  else if (parts[0] === "tasks" && parts[1] === "edux") {
    const item = db.edux.find((r) => String(r.id) === parts[2]);
    if (!item) fail(config, "Không tìm thấy bài tập EDUX.");
    if (parts[3] === "status") item.status = body.status;
    ok(item);
  } else if (path === "/tasks/checklist" && isGet) ok(db.checklists);
  else if (parts[0] === "tasks" && parts[2] === "checklist") {
    if (isPost) {
      const rows = (body.steps || [body]).map(step => ({
        checklist_id: ++sequence,
        assignment_id: Number(parts[1]),
        title: step.title, done_when: step.doneWhen || '', estimated_minutes: step.minutes || null,
        is_completed: 0,
      }));
      db.checklists.push(...rows);
      ok(body.steps ? rows : rows[0]);
    } else
      ok(db.checklists.filter((r) => String(r.assignment_id) === parts[1]));
  } else if (parts[0] === "tasks" && parts[1] === "checklist") {
    const row = db.checklists.find((r) => String(r.checklist_id) === parts[2]);
    if (!row) fail(config, "Không tìm thấy checklist.");
    if (method === "delete")
      db.checklists = db.checklists.filter((r) => r !== row);
    else if (parts[3] === "done") row.is_completed = body.isCompleted ? 1 : 0;
    else Object.assign(row, body, ...(body.doneWhen !== undefined ? [{ done_when: body.doneWhen }] : []), ...(body.minutes !== undefined ? [{ estimated_minutes: body.minutes }] : []));
    ok(row);
  } else if (parts[0] === "tags") {
    const rows = parts[1] === "edux" ? db.edux : db.tasks,
      row = rows.find((r) => String(idOf(r)) === parts[2]);
    if (!row) fail(config, "Không tìm thấy mục gắn tag.");
    row.tags = body.tags;
    ok(row);
  } else if (parts[0] === "notifications" && parts[1] === "unread-count")
    ok({ count: db.notifications.filter((n) => !n.is_read).length });
  else if (path === "/notifications/due")
    ok(db.notifications.filter((n) => !n.is_read));
  else if (parts[0] === "notifications" && parts[2] === "read") {
    const row = db.notifications.find((n) => String(idOf(n)) === parts[1]);
    if (!row) fail(config, "Không tìm thấy thông báo.");
    row.is_read = 1;
    ok(row);
  } else if (path === "/exams/upcoming")
    ok(db.exams.filter((e) => e.exam_date >= formatDateISO()));
  else if (parts[0] === "exams" && parts[2] === "study-plans")
    ok(db.plans.filter((x) => String(x.exam_id) === parts[1]));
  else if (parts[0] === "learning") {
    if (path === "/learning/courses")
      ok({ scope: {}, courses: db.courses, jobs: [] });
    else if (path === "/learning/sync")
      ok({ message: "Đã đồng bộ học liệu mẫu." });
    else if (parts[1] === "jobs") ok({ id: parts[2], status: "COMPLETED" });
    else if (parts[1] === "cards") ok({ reviewed: true, rating: body.rating });
    else {
      const course = db.courses.find((c) => String(c.id) === parts[2]);
      if (!course) fail(config, "Không tìm thấy môn học.");
      if (parts[3] === "source")
        ok({
          text: "OOP là cách tổ chức phần mềm thành các đối tượng.\n\nBốn tính chất: đóng gói, kế thừa, đa hình, trừu tượng.",
        });
      else if (parts[3] === "summary") ok({ summary: course.summary.text });
      else if (parts[3] === "summarize") ok({ jobId: "job-" + course.id });
      else ok(course);
    }
  } else if (parts[0] === "ai") {
    if (parts[1] === "status")
      ok({ available: true, online: true, provider: "mock" });
    else if (parts[1] === 'conversations') {
      if (parts[2]) {
        const row = db.conversations.find(item => item.id === decodeURIComponent(parts[2]));
        if (!row) fail(config, 'Không tìm thấy hội thoại.', 404);
        ok(row);
      } else ok([...db.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ messages, ...row }) => row));
    }
    else if (parts[1] === "pomodoro-goals") {
      const duration = Number(body.durationMinutes) || 25;
      const first = Math.max(1, Math.floor(duration / 3));
      ok({ goal: body.goal, durationMinutes: duration, persisted: false, source: "mock", note: "Gợi ý trong chế độ dữ liệu mẫu.", steps: [
        { id: "step-1", title: "Xác định một phần việc cụ thể", minutes: first, doneWhen: "Viết được đầu ra cần hoàn thành" },
        { id: "step-2", title: "Thực hành và tự kiểm tra phần việc", minutes: duration - first, doneWhen: "Có kết quả thực hành và ghi lại phần còn vướng" },
      ] });
    }
    else if (parts.at(-1) === "confirm") {
      if (!Array.isArray(body.sessions) || (!body.sessions.length && parts[1] === 'plan')) fail(config, 'Chưa có buổi học để xác nhận.', 400);
      for (const session of body.sessions) db.study.push({schedule_id:++sequence,title:session.title,study_date:session.date,start_time:session.start,end_time:session.end,status:'PLANNED'});
      for (const phase of body.phases || []) db.plans.push({id:++sequence,...normalize({examId:phase.examId,phaseTitle:phase.title,startDate:phase.startDate,endDate:phase.endDate}),status:'PLANNED'});
      ok({ persisted: true, sessions: body.sessions });
    }
    else if (["plan", "exam-plan"].includes(parts[1]))
      ok({
        answer:
          "Kế hoạch ôn tập mẫu:\n1. 19:00–19:30: Ôn lại kiến thức nền tảng.\n2. 19:30–20:00: Làm bài tập thực hành.\n3. 20:00–20:15: Ghi chú và tự kiểm tra.",
        conversationId: body.conversationId || "mock-chat",
        preview: true,
        persisted: false,
        phases: parts[1] === 'exam-plan' ? [{examId:1,title:'Ôn kiến thức nền tảng',startDate:formatDateISO(),endDate:formatDateISO(addDays(new Date(),6))}] : undefined,
        sessions: [
            {
              date: formatDateISO(addDays(new Date(), 1)),
              start: "19:00",
              end: "20:00",
              title: "Ôn kiến thức",
              subject: "Tự học",
              examId: parts[1] === 'exam-plan' ? 1 : null,
              ...(parts[1] === 'exam-plan' ? { objective: 'Giải thích được khái niệm bằng lời của mình', selfTest: 'Viết một ví dụ và tự kiểm tra kết quả' } : {}),
            },
          ],
      });
    else {
      const answer = {
        answer:
          "Đây là phản hồi trong chế độ dữ liệu mẫu.\n\nĐể học hiệu quả, bạn có thể:\n1. Đọc lại khái niệm và ghi chú ý chính.\n2. Thử một ví dụ nhỏ để kiểm tra cách hiểu.\n3. Tự giải thích lại bằng lời của mình.\n\nKhi kết nối backend thật, AI Tutor sẽ trả lời theo nội dung bạn gửi.",
        conversationId: body.conversationId || 'mock-chat-' + ++sequence,
        source: "mock",
      };
      if (parts[1] === 'ask') {
        let row = db.conversations.find(item => item.id === answer.conversationId);
        const now = new Date().toISOString();
        if (!row) { row = { id: answer.conversationId, title: body.question.slice(0, 100), createdAt: now, messages: [] }; db.conversations.push(row); }
        row.messages.push({ role: 'user', text: body.question, createdAt: now }, { role: 'assistant', text: answer.answer, createdAt: now });
        row.updatedAt = now;
      }
      ok(answer);
    }
  } else if (parts[0] === "email") {
    if (parts[1] === "status")
      ok({ connected: db.connections.outlook, synced: true });
    else if (parts[1] === "session") {
      db.connections.outlook = false;
      ok({ connected: false });
    } else if (parts[1] === "sync") ok({ synced: true });
    else if (parts[1] === "read") {
      db.emails.forEach((r) => (r.read = true));
      ok({ updated: db.emails.length });
    } else if (parts.length > 1) {
      const row = db.emails.find((r) => r.id === parts[1]);
      if (!row) fail(config, "Không tìm thấy email.");
      if (parts[2] === "read") row.read = true;
      if (parts[2] === "task") {
        const task = {
          assignment_id: ++sequence,
          title: row.subject,
          description: row.body,
          deadline: formatDateISO(addDays(new Date(), 1)) + "T23:59",
          priority: "MEDIUM",
          status: "PENDING",
        };
        db.tasks.push(task);
        ok(task);
      } else if (parts[2] === "exam") {
        const exam = {
          exam_id: ++sequence,
          subject_name: row.subject,
          exam_date: formatDateISO(addDays(new Date(), 7)),
          start_time: "08:00",
          room: "",
        };
        db.exams.push(exam);
        ok(exam);
      } else ok(row);
    } else ok(db.emails);
  } else if (parts[0] === "sync") {
    if (path === "/sync" && isPost || parts[1] === "all") {
      const selected = body.sources || ["IU", "EDUX", "OUTLOOK"], finishedAt = new Date().toISOString();
      latestSyncJob = { jobId: "sync-" + ++sequence, status: "COMPLETED", ok: true, sources: selected,
        progress: { completed: selected.length, total: selected.length, percent: 100 }, activeSource: null,
        createdAt: finishedAt, startedAt: finishedAt, finishedAt, completedSources: selected, pendingSources: [], failedSources: [],
        results: Object.fromEntries(selected.map((key) => [key.toLowerCase(), { ok: true, synced: true, status: "COMPLETED", finishedAt, message: "Đã đồng bộ dữ liệu mẫu." }])) };
      for (const source of selected) syncTimes[source.toLowerCase()] = finishedAt;
      syncJobs.set(latestSyncJob.jobId, latestSyncJob);
      ok(latestSyncJob);
    } else if (parts[1] === "status") {
      const job = p.jobId ? syncJobs.get(p.jobId) : latestSyncJob;
      if (p.jobId && !job) fail(config, "Không tìm thấy tiến trình đồng bộ.", 404);
      ok(job || { status: "IDLE", results: {}, message: "Chưa có lần đồng bộ nào." });
    } else if (parts[1] === "sources")
      ok(
        ["iu", "edux", "outlook"].map((key) => ({
          key,
          connected: db.connections[key],
          lastSync: syncTimes[key] || null,
          syncing: false,
        })),
      );
    else if (parts[1] === "current-courses")
      ok({ resolved: true, semester: "HK1", academicYear: "2026-2027", courses: fixture.mockSubjects.map(subject => ({ subjectId: subject.subject_id, subjectName: subject.subject_name, subjectCode: subject.subject_code })) });
    else if (parts[1] === "iu" || parts[1] === "edux") {
      const key = parts[1];
      if (parts[2] === "session") db.connections[key] = method !== "delete";
      ok({ connected: db.connections[key], syncing: false });
    } else
      ok({
        syncing: false,
        message: "Dữ liệu mẫu đã sẵn sàng.",
        sources: db.connections,
      });
  } else if (path === "/weaknesses/analyze") {
    db.weaknesses = [
      {
        id: 1,
        subject: "Lập trình C#",
        topic: "Kế thừa và đa hình",
        level: "Trung bình",
        recommendation: "Ôn lại lý thuyết, sau đó làm 3 bài tập thực hành.",
      },
    ];
    ok({ topics: db.weaknesses });
  } else if (parts[0] === "quizzes" && parts[2] === "submit") {
    const quiz = db.quizzes.find((q) => q.id === parts[1]);
    if (!quiz) fail(config, "Không tìm thấy quiz.");
    const correct = quiz.questions.filter(
      (q, i) => Number(body.answers?.[q.id ?? i]) === q.correct,
    ).length;
    ok({
      score: correct + "/" + quiz.questions.length,
      correctCount: correct,
      feedback: "Xem lại những câu chưa chắc để nhớ lâu hơn nhé.",
      results: quiz.questions.map((q, i) => ({
        correct: Number(body.answers?.[q.id ?? i]) === q.correct,
        explanation: q.options[q.correct],
      })),
    });
  } else if (parts[0] === "documents" && parts[2] === "file") {
    const doc = db.documents.find((d) => String(d.id) === parts[1]);
    if (!doc) fail(config, "Không tìm thấy tài liệu.");
    const blob = db.files.get(doc.id) || (doc.type === 'pdf' ? mockPdf() : doc.type === 'docx' ? mockDocx(doc.title, 'Tài liệu mẫu để kiểm tra giao diện.') : null);
    if (!blob) fail(config, 'Tài liệu mẫu này chỉ có metadata. Hãy tải lên một tập tin để thử tải xuống.', 404);
    return {
      data: blob,
      status: 200,
      statusText: "OK",
      headers: { "content-type": blob.type },
      config,
    };
  } else if (
    ["notes", "notebooks"].includes(parts[0]) &&
    parts[2] === "export"
  ) {
    const item = db[parts[0]].find((r) => String(r.id) === parts[1]);
    if (!item) fail(config, "Không tìm thấy ghi chú.");
    return {
      data: mockDocx(item.title, item.content || item.description || ''),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  } else {
    let key = parts[0],
      id = parts[1],
      idKey = "id";
    if (key === "schedules") {
      key = parts[1] === "study" ? "study" : "schedules";
      id = key === "study" ? parts[2] : parts[1];
      idKey = key === "study" ? "schedule_id" : "timetable_id";
    }
    if (key === "exams" && parts[1] === "study-plans") {
      key = "plans";
      id = parts[2];
    }
    if (key === "tasks") idKey = "assignment_id";
    if (key === "exams") idKey = "exam_id";
    if (key === "notifications") idKey = "notification_id";
    if (key === "pomodoro") key = "sessions";
    const rows = db[key];
    if (!Array.isArray(rows))
      fail(
        config,
        "Chưa có dữ liệu mẫu cho " + method.toUpperCase() + " " + path,
        501,
      );
    if (key === "sessions" && method === "delete") {
      db.sessions = [];
      ok({ deleted: true });
    } else if (key === "weaknesses" && isGet) {
      ok({ topics: rows });
    } else if (isGet && !id) {
      ok(
        key === "study"
          ? range(rows, p)
          : rows.filter((r) => !p.status || r.status === p.status),
      );
    } else if (isPost && !id) {
      let value = key === "sessions" ? { ...body } : normalize(body);
      if (key === "documents") {
        let info =
          config.headers?.get?.("X-Document-Meta") ||
          config.headers?.["X-Document-Meta"] ||
          "{}";
        try {
          info = JSON.parse(decodeURIComponent(info));
        } catch {
          info = {};
        }
        value = {
          ...info,
          subject: info.subjectId ? subject(info.subjectId).subject_name : info.subject || '',
          semester: info.subjectId ? 'HK1' : '', academicYear: info.subjectId ? '2026-2027' : '',
          title: info.title || "Tài liệu mới",
          type: (info.filename || info.title || "file").split(".").at(-1),
          size: config.data?.size || 0,
          uploadedAt: formatDateISO(),
        };
      }
      if (key === "quizzes")
        value = {
          ...clone(fixture.mockQuizzes[0]),
          title: "Quiz: " + body.subject,
          subject: body.subject,
          topic: body.topic, difficulty: body.difficulty, source: { kind: 'mock', title: 'Quiz mẫu: chưa đọc tài liệu thật' },
        };
      const row = {
        ...value,
        [idKey]: ++sequence,
        status:
          value.status ||
          (key === "tasks"
            ? "PENDING"
            : key === "study"
              ? "PLANNED"
              : undefined),
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      if (key === "documents") db.files.set(row.id, config.data);
      ok(row);
    } else {
      const row = rows.find((r) => String(idOf(r)) === String(id));
      if (!row) fail(config, "Không tìm thấy bản ghi.");
      if (method === "delete") {
        db[key] = rows.filter((r) => r !== row);
        ok({ deleted: true });
      } else if (method === "patch" || method === "put") {
        Object.assign(row, normalize(body));
        if (parts.at(-1) === "status" && key === "tasks")
          row.completed_at =
            body.status === "COMPLETED" ? new Date().toISOString() : null;
        ok(row);
      } else if (isGet) ok(row);
      else fail(config, "Thao tác mẫu không được hỗ trợ.", 501);
    }
  }
  return {
    data: {
      success: true,
      ...(data === undefined ? {} : { data: clone(data) }),
      ...meta,
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

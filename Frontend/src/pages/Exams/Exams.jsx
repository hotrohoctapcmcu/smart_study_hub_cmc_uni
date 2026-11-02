import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { examApi, studentApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList } from "../../api/apiClient";
import { mapExam } from "../../utils/examAdapter";
import {
  formatDate,
  formatDateISO,
  formatTime,
  daysAgo,
  minutes,
  startOfWeek,
  addDays,
  isToday,
} from "../../utils/date";
import {
  PageHeader,
  Card,
  Button,
  Tabs,
  ApiContent,
  EmptyState,
  Modal,
  ConfirmModal,
  Field,
  Badge,
  ErrorState,
  useAction,
} from "../../components/common/ui";
export default function Exams() {
  const state = useApi(examApi.list),
    plans = useApi(examApi.getStudyPlans);
  const [tab, setTab] = useState("upcoming"),
    [calendarMonth, setCalendarMonth] = useState(() => new Date()),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [plan, setPlan] = useState(null),
    [removePlan, setRemovePlan] = useState(null);
  const { run, busy } = useAction();
  const exams = responseList(state.data, "exams").map(mapExam),
    rows = exams.filter((e) => tab !== "upcoming" || daysAgo(e.examDate) >= 0),
    studyPlans = responseList(plans.data, "studyPlans");
  const firstCalendarDate = startOfWeek(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
  return (
    <div className="page exams-page">
      <PageHeader
        eyebrow="SẴN SÀNG CHO CỘT MỐC MỚI"
        title="Kỳ thi"
        description="Chuẩn bị từng chút để bước vào phòng thi thật tự tin."
      >
        <Button onClick={() => setEditor({})}>
          <Plus size={15} />
          Thêm kỳ thi
        </Button>
      </PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ["upcoming", "Sắp tới"],
          ["all", "Tất cả"],
          ["calendar", "Lịch thi"],
          ["plans", "Kế hoạch ôn thi"],
        ]}
      />
      {tab === "calendar" ? (
        <Card title="Lịch thi theo tháng" region="C">
          <div className="calendar-toolbar">
            <div className="actions">
              <Button variant="ghost" aria-label="Tháng thi trước" onClick={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ChevronLeft size={17} /></Button>
              <strong>Tháng {calendarMonth.getMonth() + 1}/{calendarMonth.getFullYear()}</strong>
              <Button variant="ghost" aria-label="Tháng thi sau" onClick={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ChevronRight size={17} /></Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCalendarMonth(new Date())}>Hôm nay</Button>
          </div>
          <ApiContent state={state}>
            <div className="calendar-wrap">
              <div className="month-weekdays">{["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"].map(day => <strong key={day}>{day}</strong>)}</div>
              <div className="month-grid">
                {Array.from({ length: 42 }, (_, i) => addDays(firstCalendarDate, i)).map(date => <div key={formatDateISO(date)} className={"month-cell " + (isToday(date) ? "today " : "") + (date.getMonth() !== calendarMonth.getMonth() ? "outside" : "")}>
                  <strong>{date.getDate()}</strong>
                  {exams.filter(exam => formatDateISO(exam.examDate) === formatDateISO(date)).map(exam => <button key={exam.id} onClick={() => setEditor(exam)} title="Xem và chỉnh sửa kỳ thi">{formatTime(exam.startTime)} · {exam.subjectName || exam.examName || "Kỳ thi"}</button>)}
                </div>)}
              </div>
            </div>
          </ApiContent>
        </Card>
      ) : tab === "plans" ? (
        <Card title="Kế hoạch ôn thi" region="D">
          <ApiContent state={plans} empty={!studyPlans.length}>
            {studyPlans.map((p) => (
              <div className="task-row" key={p.plan_id ?? p.id}>
                <input
                  aria-label={"Hoàn thành " + (p.phase_title || p.title || "kế hoạch ôn thi")}
                  type="checkbox"
                  checked={p.status === "COMPLETED"}
                  disabled={busy}
                  onChange={() =>
                    run(async () => {
                      await examApi.changeStudyPlanStatus(
                        p.plan_id ?? p.id,
                        p.status === "COMPLETED" ? "PLANNED" : "COMPLETED",
                      );
                      await plans.refetch();
                    })
                  }
                />
                <div className="task-info">
                  <h3>
                    {p.phase_title || p.title || p.subject_name || "Ôn thi"}
                  </h3>
                  <p className="hint">
                    {formatDate(p.start_date || p.study_date || p.studyDate)} ·{" "}
                    {p.notes || p.content}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  aria-label="Xóa kế hoạch ôn thi"
                  onClick={() => setRemovePlan({ ...p, id: p.plan_id ?? p.id })}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </ApiContent>
        </Card>
      ) : (
        <ApiContent state={state}>
          {rows.length ? (
            <div className="exam-grid" data-region="B" aria-label="B. Danh sách kỳ thi">
              {rows.map((e) => (
                <article className="card exam-card" key={e.id}>
                  <div className="filter-bar">
                    <div className="course-symbol">
                      <CalendarDays size={22} />
                    </div>
                    <Badge
                      variant={daysAgo(e.examDate) < 4 ? "warning" : "primary"}
                      label={
                        daysAgo(e.examDate) < 0
                          ? "Đã diễn ra"
                          : daysAgo(e.examDate) === 0
                            ? "Hôm nay"
                            : "Còn " + daysAgo(e.examDate) + " ngày"
                      }
                    />
                  </div>
                  <h3>{e.subjectName || "Kỳ thi"}</h3>
                  <p className="muted">{e.subjectCode}</p>
                  {e.examName && <p>{e.examName}</p>}
                  <div className="stack" style={{ gap: 7, fontSize: 11 }}>
                    <span className="actions">
                      <CalendarDays size={14} />
                      {formatDate(e.examDate)}
                    </span>
                    <span className="actions">
                      <Clock size={14} />
                      {formatTime(e.startTime)}
                    </span>
                    <span className="actions">
                      <MapPin size={14} />
                      {e.room || "Chưa có phòng"}
                    </span>
                  </div>
                  <p className="hint">{e.notes}</p>
                  <div className="document-card-footer">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlan(e)}
                    >
                      Lên lịch ôn
                    </Button>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        aria-label="Sửa kỳ thi"
                        onClick={() => setEditor(e)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Xóa kỳ thi"
                        onClick={() => setDeleting(e)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                title="Chưa có kỳ thi nào"
                description="Bạn có thể thêm lịch thi hoặc đồng bộ từ IU."
              />
            </Card>
          )}
        </ApiContent>
      )}
      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Sửa kỳ thi" : "Thêm kỳ thi"}
      >
        {editor && (
          <ExamEditor
            exam={editor}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              await state.refetch();
            }}
          />
        )}
      </Modal>
      <ConfirmModal
        item={deleting}
        onClose={() => setDeleting(null)}
        busy={busy}
        onConfirm={() =>
          run(async () => {
            await examApi.remove(deleting.id);
            setDeleting(null);
            await state.refetch();
          }, "Đã xóa kỳ thi")
        }
      />
      <ConfirmModal
        item={removePlan}
        onClose={() => setRemovePlan(null)}
        busy={busy}
        onConfirm={() =>
          run(async () => {
            await examApi.removeStudyPlan(removePlan.id);
            setRemovePlan(null);
            await plans.refetch();
          }, "Đã xóa kế hoạch")
        }
      />
      <Modal
        isOpen={!!plan}
        onClose={() => setPlan(null)}
        title={"Lên lịch ôn: " + (plan?.subjectName || "")}
      >
        {plan && (
          <StudyPlanEditor
            exam={plan}
            onClose={() => setPlan(null)}
            onSaved={async () => {
              setPlan(null);
              await plans.refetch();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
function ExamEditor({ exam, onClose, onSaved }) {
  const subjects = useApi(studentApi.getSubjects);
  const [form, setForm] = useState({
      subjectId: exam.subjectId || "",
      examDate: formatDateISO(exam.examDate) || formatDateISO(),
      startTime: exam.startTime?.slice(0, 5) || "08:00",
      endTime: exam.endTime?.slice(0, 5) || "",
      room: exam.room || "",
      examName: exam.examName || exam.exam_name || "Thi kết thúc học phần",
    }),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const f = (k) => ({
    value: form[k],
    onChange: (e) => setForm((v) => ({ ...v, [k]: e.target.value })),
  });
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          if (form.endTime && minutes(form.endTime) <= minutes(form.startTime))
            throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
          const body = {
            subjectId: Number(form.subjectId),
            examDate: form.examDate,
            examTime: form.startTime,
            room: form.room,
            ...(form.endTime
              ? { durationMinutes: minutes(form.endTime) - minutes(form.startTime) }
              : exam.id ? {} : { durationMinutes: 90 }),
            examName: form.examName.trim(),
          };
          await (exam.id
            ? examApi.update(exam.id, body)
            : examApi.create(body));
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorState error={error} title="Chưa lưu được kỳ thi" />}
      <Field label="Tên kỳ thi" required {...f("examName")} />
      <Field label="Môn học">
        <select required {...f("subjectId")}>
          <option value="">Chọn môn học</option>
          {responseList(subjects.data, "subjects").map((s) => (
            <option key={s.subject_id ?? s.id} value={s.subject_id ?? s.id}>
              {s.subject_name || s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ngày thi" type="date" required {...f("examDate")} />
      <div className="form-grid">
        <Field label="Bắt đầu" type="time" required {...f("startTime")} />
        <Field label="Kết thúc" type="time" {...f("endTime")} />
      </div>
      <Field label="Phòng thi" required {...f("room")} />
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          Lưu kỳ thi
        </Button>
      </div>
    </form>
  );
}
function StudyPlanEditor({ exam, onClose, onSaved }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          if (form.get("endDate") < form.get("startDate"))
            throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
          await examApi.createStudyPlan({
            examId: exam.id,
            phaseTitle: form.get("title"),
            startDate: form.get("startDate"),
            endDate: form.get("endDate"),
            notes: form.get("notes"),
          });
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorState error={error} title="Chưa lưu được kế hoạch" />}
      <Field
        label="Nội dung ôn tập"
        name="title"
        required
        defaultValue={"Ôn " + exam.subjectName}
      />
      <div className="form-grid">
        <Field
          label="Từ ngày"
          type="date"
          name="startDate"
          required
          defaultValue={formatDateISO()}
          max={formatDateISO(exam.examDate)}
        />
        <Field
          label="Đến ngày"
          type="date"
          name="endDate"
          required
          defaultValue={formatDateISO(exam.examDate)}
          max={formatDateISO(exam.examDate)}
        />
      </div>
      <Field label="Ghi chú">
        <textarea name="notes" />
      </Field>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          Lưu kế hoạch
        </Button>
      </div>
    </form>
  );
}

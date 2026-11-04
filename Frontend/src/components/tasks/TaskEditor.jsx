import { useState } from "react";
import { Button, Field, ErrorState } from "../common/ui";
import { taskApi } from "../../api";
import { useCurrentCourses } from "../../hooks/useCurrentCourses";
import CurrentCourseHint from "../common/CurrentCourseHint";
import { assertFutureDateTime, nextPlanningMinute } from "../../utils/planning";
export default function TaskEditor({ task, onSaved, onClose }) {
  const subjects = useCurrentCourses(task?.subjectId, task?.subject || task?.subjectName);
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: task?.title || "",
    subjectId: task?.subjectId || "",
    deadline: (task?.deadline || "").replace(" ", "T").slice(0, 16),
    description: task?.description || "",
    priority: task?.priority || "MEDIUM",
  });
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });
  const deadlineChanged = !task?.id || form.deadline !== (task.deadline || "").replace(" ", "T").slice(0, 16);
  async function save(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = {
        ...form,
        title: form.title.trim(),
        subjectId: Number(form.subjectId),
      };
      if (!body.title) throw new Error("Vui lòng nhập tên công việc.");
      if (!body.subjectId) throw new Error("Vui lòng chọn môn học.");
      if (deadlineChanged) assertFutureDateTime(body.deadline, "Hạn hoàn thành");
      await (task ? taskApi.update(task.id, body) : taskApi.create(body));
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="stack">
      {error && <ErrorState error={error} title="Chưa lưu được công việc" />}
      <Field
        label="Tên công việc"
        required
        maxLength={250}
        {...field("title")}
      />
      <div className="form-grid">
        <Field label="Môn học">
          <select required {...field("subjectId")}>
            <option value="">Chọn môn học</option>
            {subjects.subjects.map((s) => (
              <option key={s.subject_id ?? s.id} value={s.subject_id ?? s.id}>
                {s.subject_name || s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mức độ ưu tiên">
          <select {...field("priority")}>
            {[
              ["LOW", "Thấp"],
              ["MEDIUM", "Trung bình"],
              ["HIGH", "Cao"],
              ["URGENT", "Khẩn cấp"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Hạn hoàn thành"
        type="datetime-local"
        required
        min={deadlineChanged ? nextPlanningMinute() : undefined}
        {...field("deadline")}
      />
      <Field label="Mô tả">
        <textarea {...field("description")} />
      </Field>
      <CurrentCourseHint state={subjects} />
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu..." : "Lưu công việc"}
        </Button>
      </div>
    </form>
  );
}

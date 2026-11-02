import { useState } from "react";
import { Button, Field, ErrorState } from "../common/ui";
import { taskApi, studentApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
export default function TaskEditor({ task, onSaved, onClose }) {
  const subjects = useApi(studentApi.getSubjects);
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
            {responseList(subjects.data, "subjects").map((s) => (
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
        {...field("deadline")}
      />
      <Field label="Mô tả">
        <textarea {...field("description")} />
      </Field>
      {subjects.error && (
        <p className="hint">
          Chưa tải được môn học. Hãy kiểm tra kết nối hoặc đồng bộ dữ liệu trước khi lưu.
        </p>
      )}
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

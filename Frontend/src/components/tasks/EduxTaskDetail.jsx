import { useState } from "react";
import { taskApi, tagApi } from "../../api";
import { formatDateTime } from "../../utils/date";
import { Badge, Button, Field, useAction } from "../common/ui";

export default function EduxTaskDetail({ assignment, onUpdate }) {
  const [tags, setTags] = useState(Array.isArray(assignment.tags) ? assignment.tags.join(", ") : "");
  const { run, busy } = useAction();
  const progress = assignment.progress;
  const progressText = typeof progress === "object" && progress !== null
    ? `${progress.daHoc ?? progress.completed ?? 0}/${progress.tongSo ?? progress.total ?? 0}`
    : progress;
  const dueLabel = assignment.dueSource === "subject" ? "Hạn học phần"
    : assignment.dueSource === "exam" ? "Hạn bài kiểm tra" : "Hạn nộp";
  return (
    <div className="stack">
      <h3>{assignment.title || "Bài tập EDUX"}</h3>
      <p className="muted">{[assignment.subject, assignment.subjectCode, assignment.chapter].filter(Boolean).join(" · ")}</p>
      <div className="actions">
        <Badge label={assignment.status || "Chưa làm"} />
        {progressText != null && <Badge label={`Tiến độ: ${progressText}`} />}
        <Badge label={assignment.highestScore == null ? "Chưa có điểm" : `Điểm cao nhất: ${assignment.highestScore}`} variant="success" />
      </div>
      <p>{dueLabel}: {assignment.due ? formatDateTime(assignment.due) : "Chưa đặt hạn"}{assignment.dueSource === "subject" && assignment.due && " (áp dụng chung cho học phần)"}</p>
      {assignment.dueSource === "exam" && assignment.subjectDeadline && assignment.subjectDeadline !== assignment.due && <p>Hạn học phần: {formatDateTime(assignment.subjectDeadline)} (áp dụng chung cho học phần)</p>}
      <p className="pre-wrap">{assignment.description || "Chưa có mô tả."}</p>
      <Field label="Trạng thái EDUX">
        <select value={assignment.status || "Chưa làm"} disabled={busy} onChange={(e) => {
          const status = e.target.value;
          run(async () => { await taskApi.eduxStatus(assignment.id, status); await onUpdate(); });
        }}>
          {["Chưa làm", "Đang làm", "Hoàn thành"].map((status) => <option key={status}>{status}</option>)}
        </select>
      </Field>
      {Array.isArray(assignment.questions) && assignment.questions.length > 0 && (
        <section className="stack" aria-label="Câu hỏi EDUX">
          <h3>Câu hỏi đã đồng bộ</h3>
          {assignment.questions.map((question, i) => <div className="schedule-note" key={question.id || i}>
            <p>{i + 1}. {typeof question === "string" ? question : question.question || question.content || question.title || "Câu hỏi"}</p>
            {Array.isArray(question.options) && <ul>{question.options.map((option, j) => <li key={j}>{typeof option === "string" ? option : option.text || option.content || option.label}</li>)}</ul>}
          </div>)}
        </section>
      )}
      <Field label="Tag EDUX (phân cách bằng dấu phẩy)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <Button variant="outline" disabled={busy} onClick={() => run(async () => {
        await tagApi.updateEdux(assignment.id, [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))]);
        await onUpdate();
      }, "Đã lưu tag EDUX")}>Lưu tag EDUX</Button>
    </div>
  );
}

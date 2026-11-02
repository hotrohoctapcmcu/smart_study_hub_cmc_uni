import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { taskApi, tagApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { Button, Badge, Field, ApiContent, useAction } from "../common/ui";
import { formatDateTime } from "../../utils/date";
export default function TaskDetail({ task, onUpdate, onEdit }) {
  const checklist = useApi(() => taskApi.taskChecklist(task.id));
  const [title, setTitle] = useState(""),
    [editing, setEditing] = useState(null),
    [checklistTitle, setChecklistTitle] = useState(""),
    [tags, setTags] = useState(
      Array.isArray(task.tags) ? task.tags.join(", ") : "",
    );
  const { run, busy } = useAction();
  const rows = responseList(checklist.data, "checklist");
  return (
    <div className="stack">
      <div className="actions">
        <Badge label={task.statusLabel} />
        <Badge label={task.priorityLabel} variant="warning" />
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil size={13} />
          Sửa
        </Button>
      </div>
      <p className="muted">
        {task.subject} · Hạn {formatDateTime(task.deadline)}
      </p>
      <p className="pre-wrap">{task.description || "Chưa có mô tả."}</p>
      <Field label="Trạng thái">
        <select
          value={task.status}
          disabled={busy}
          onChange={(e) => {
            const status = e.target.value;
            run(async () => {
              await taskApi.changeStatus(task.id, status);
              await onUpdate();
            });
          }}
        >
          {[
            ["PENDING", "Chưa làm"],
            ["IN_PROGRESS", "Đang làm"],
            ["COMPLETED", "Hoàn thành"],
            ["OVERDUE", "Quá hạn"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <h3>Checklist</h3>
      <ApiContent state={checklist}>
        {rows.map((r) => (
          <div className="summary-line" key={r.checklist_id ?? r.id}>
            {editing === (r.checklist_id ?? r.id) ? (
              <form className="stack" style={{ flex: 1 }} onSubmit={(e) => {
                e.preventDefault();
                if (!checklistTitle.trim()) return;
                run(async () => {
                  await taskApi.updateChecklist(r.checklist_id ?? r.id, { title: checklistTitle.trim() });
                  setEditing(null);
                  await checklist.refetch();
                });
              }}>
                <Field label="Tên bước checklist" value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} required autoFocus />
                <div className="actions">
                  <Button type="submit" size="sm" disabled={busy || !checklistTitle.trim()}>Lưu checklist</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Hủy sửa checklist</Button>
                </div>
              </form>
            ) : <label className="actions">
              <input
                type="checkbox"
                checked={!!Number(r.is_completed)}
                disabled={busy}
                onChange={() =>
                  run(async () => {
                    await taskApi.toggleChecklist(
                      r.checklist_id ?? r.id,
                      !Number(r.is_completed),
                    );
                    await checklist.refetch();
                  }, "")
                }
              />
              {r.title}
            </label>}
            {editing !== (r.checklist_id ?? r.id) && <div className="actions">
              <Button
                variant="ghost"
                aria-label="Sửa checklist"
                disabled={busy}
                onClick={() => {
                  setEditing(r.checklist_id ?? r.id);
                  setChecklistTitle(r.title || "");
                }}
              >
                <Pencil size={13} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Xóa checklist"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await taskApi.removeChecklist(r.checklist_id ?? r.id);
                    await checklist.refetch();
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>}
          </div>
        ))}
        {!rows.length && (
          <p className="hint">Chia công việc thành những bước nhỏ.</p>
        )}
      </ApiContent>
      <form
        className="actions"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim())
            run(async () => {
              await taskApi.createChecklist(task.id, { title: title.trim() });
              setTitle("");
              await checklist.refetch();
            });
        }}
      >
        <input
          aria-label="Bước checklist mới"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm một bước..."
          required
        />
        <Button type="submit" size="sm" disabled={busy}>
          <Plus size={15} />
          Thêm
        </Button>
      </form>
      <Field
        label="Tag (phân cách bằng dấu phẩy)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await tagApi.updateTask(
              task.id,
              tags
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            );
            await onUpdate();
          }, "Đã lưu tag")
        }
      >
        Lưu tag
      </Button>
    </div>
  );
}

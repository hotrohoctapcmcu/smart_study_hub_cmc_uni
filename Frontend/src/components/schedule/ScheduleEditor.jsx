import { useState } from "react";
import { useCurrentCourses } from "../../hooks/useCurrentCourses";
import CurrentCourseHint from "../common/CurrentCourseHint";
import { scheduleApi } from "../../api";
import { unwrapResponse } from "../../api/apiClient";
import { Button, Field, Tabs, ErrorState } from "../common/ui";
import {
  formatDateISO,
  formatTime,
  minutes,
  parseDate,
} from "../../utils/date";
import { assertFutureDateTime, defaultStudySlot, nextPlanningMinute, planningNow } from "../../utils/planning";
export default function ScheduleEditor({ event, onSaved, onClose }) {
  const subjects = useCurrentCourses(event?.subjectId, event?.subjectName || event?.subject);
  const [defaultSlot] = useState(defaultStudySlot);
  const [kind, setKind] = useState(event?.kind || "study"),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [conflicts, setConflicts] = useState([]);
  const [form, setForm] = useState({
    title: event?.title || "",
    subjectId: event?.subjectId || "",
    studyDate: formatDateISO(event?.studyDate || defaultSlot.studyDate),
    startTime: event?.startTime?.slice(0, 5) || (event?.studyDate && event.studyDate > planningNow().date ? "19:00" : defaultSlot.startTime),
    endTime: event?.endTime?.slice(0, 5) || (event?.studyDate && event.studyDate > planningNow().date ? "20:00" : defaultSlot.endTime),
    notes: event?.notes || "",
    className: event?.className || "",
    room: event?.room || "",
  });
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });
  const timingChanged = !event?.id || form.studyDate !== formatDateISO(event.studyDate)
    || form.startTime !== event.startTime?.slice(0, 5) || form.endTime !== event.endTime?.slice(0, 5);
  const earliestStart = timingChanged && form.studyDate === planningNow().date
    ? nextPlanningMinute().slice(11, 16) : "07:00";
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      if (timingChanged) assertFutureDateTime(`${form.studyDate}T${form.startTime}`, "Giờ bắt đầu học");
      if (minutes(form.endTime) <= minutes(form.startTime))
        throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
      const result = await scheduleApi.checkConflicts({
        studyDate: form.studyDate,
        startTime: form.startTime,
        endTime: form.endTime,
        excludeScheduleId: event?.id || null,
      });
      const check = { ...result.data, ...unwrapResponse(result) };
      if (check.hasConflict) {
        setConflicts(check.conflicts || []);
        throw new Error(
          "Khoảng giờ này trùng với lịch đã có. Hãy chọn giờ khác.",
        );
      }
      const body = {
        title: form.title,
        subjectId: form.subjectId ? Number(form.subjectId) : null,
        studyDate: form.studyDate,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes,
      };
      if (kind === "class" && !body.subjectId)
        throw new Error("Vui lòng chọn môn học cho tiết học.");
      if (event?.id) await scheduleApi.update(event.id, body);
      else
        await (kind === "study"
          ? scheduleApi.create(body)
          : scheduleApi.createClass({
              subjectId: body.subjectId,
              className: form.className,
              room: form.room,
              startTime: body.startTime,
              endTime: body.endTime,
              startDate: body.studyDate,
              endDate: body.studyDate,
              dayOfWeek:
                parseDate(body.studyDate).getDay() === 0
                  ? 8
                  : parseDate(body.studyDate).getDay() + 1,
            }));
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="stack">
      {!event?.id && (
        <Tabs
          items={[
            ["study", "Lịch tự học"],
            ["class", "Tiết trên lớp"],
          ]}
          value={kind}
          onChange={setKind}
        />
      )}
      {error && <ErrorState error={error} title="Chưa lưu được lịch" />}
      {conflicts.map((c, i) => (
        <p key={i} className="hint">
          {c.title || c.subject_name} · {formatTime(c.start_time)} -{" "}
          {formatTime(c.end_time)}
        </p>
      ))}
      {kind === "study" && (
        <Field label="Tên buổi tự học" required {...field("title")} />
      )}
      <Field label="Môn học">
        <select {...field("subjectId")} required={kind === "class"}>
          <option value="">Chưa phân loại</option>
          {subjects.subjects.map((s) => (
            <option key={s.subject_id ?? s.id} value={s.subject_id ?? s.id}>
              {s.subject_name || s.name}
            </option>
          ))}
        </select>
      </Field>
      <CurrentCourseHint state={subjects} />
      <Field label="Ngày học" type="date" required min={timingChanged ? planningNow().date : undefined} {...field("studyDate")} />
      <div className="form-grid">
        <Field
          label="Bắt đầu"
          type="time"
          required
          min={earliestStart > "07:00" ? earliestStart : "07:00"}
          max="21:59"
          {...field("startTime")}
        />
        <Field
          label="Kết thúc"
          type="time"
          required
          min="07:01"
          max="22:00"
          {...field("endTime")}
        />
      </div>
      {kind === "class" && (
        <div className="form-grid">
          <Field label="Lớp" {...field("className")} />
          <Field label="Phòng học" {...field("room")} />
        </div>
      )}
      <Field label="Ghi chú">
        <textarea {...field("notes")} />
      </Field>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang kiểm tra..." : "Lưu lịch học"}
        </Button>
      </div>
    </form>
  );
}

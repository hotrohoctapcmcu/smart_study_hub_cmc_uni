import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Clock,
} from "lucide-react";
import { scheduleApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { expandClassSchedules, mapSchedule } from "../../utils/scheduleAdapter";
import {
  formatDateISO,
  formatDate,
  formatTime,
  weekDays,
  addDays,
  startOfWeek,
  isToday,
  parseDate,
} from "../../utils/date";
import {
  PageHeader,
  Card,
  Tabs,
  Button,
  ApiContent,
  EmptyState,
  Modal,
  ConfirmModal,
  Field,
  Badge,
  useAction,
} from "../../components/common/ui";
import { ScheduleItem } from "../../components/dashboard/Widgets";
import WeeklyCalendar from "../../components/schedule/WeeklyCalendar";
import ScheduleEditor from "../../components/schedule/ScheduleEditor";

export default function Schedule() {
  const [params, setParams] = useSearchParams();
  const requestedDate = params.get("date");
  const [view, setView] = useState("week"),
    [anchor, setAnchor] = useState(() => parseDate(requestedDate) || new Date()),
    [editor, setEditor] = useState(null),
    [selected, setSelected] = useState(null),
    [deleting, setDeleting] = useState(null);
  const [slotDate, setSlotDate] = useState(formatDateISO()),
    [duration, setDuration] = useState(60);
  const { run, busy } = useAction();
  useEffect(() => {
    if (params.get("action") !== "create") return;
    setEditor({ kind: "study" });
    const next = new URLSearchParams(params);
    next.delete("action");
    setParams(next, { replace: true });
  }, [params, setParams]);
  useEffect(() => {
    const date = parseDate(requestedDate);
    if (date) setAnchor(date);
  }, [requestedDate]);
  const state = useApi(async () => {
    const days = weekDays(anchor),
      monthStart = startOfWeek(
        new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      );
    const from = formatDateISO(view === "month" ? monthStart : days[0]),
      to = formatDateISO(view === "month" ? addDays(monthStart, 41) : days[6]);
    const [classes, study] = await Promise.all([
      view === "list" ? scheduleApi.list() : scheduleApi.byWeek(from, to),
      scheduleApi.study(view === "list" ? {} : { from, to }),
    ]);
    return [
      ...expandClassSchedules(responseList(classes), view === "list" ? undefined : from, view === "list" ? undefined : to).map((r) => ({
        ...mapSchedule(r),
        kind: "class",
      })),
      ...responseList(study).map((r) => ({ ...mapSchedule(r), kind: "study" })),
    ].sort((a, b) =>
      (a.studyDate + a.startTime).localeCompare(b.studyDate + b.startTime),
    );
  });
  const slots = useApi(() => scheduleApi.getFreeSlots(slotDate, duration), {
    immediate: false,
  });
  useEffect(() => {
    state.execute();
  }, [anchor, view, state.execute]);
  const days = weekDays(anchor),
    rows = Array.isArray(state.data) ? state.data : [];
  const start = startOfWeek(
    new Date(anchor.getFullYear(), anchor.getMonth(), 1),
  );
  const dates = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  function move(n) {
    setAnchor((d) =>
      view === "month"
        ? new Date(d.getFullYear(), d.getMonth() + n, 1)
        : addDays(d, 7 * n),
    );
  }
  async function reload() {
    await state.refetch();
    window.dispatchEvent(new Event("workspace-updated"));
  }
  return (
    <div className="page schedule-page">
      <PageHeader
        eyebrow="SẮP XẾP MỘT NGÀY THẬT TỐT"
        title="Thời khóa biểu"
        description="Sắp xếp thời gian, sẵn sàng cho một tuần mới."
      >
        <Button onClick={() => setEditor({ kind: "study" })}>
          <Plus size={15} />
          Thêm lịch học
        </Button>
      </PageHeader>
      <div className="filter-bar" data-region="B" aria-label="B. Chế độ xem lịch">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            ["week", "Tuần"],
            ["month", "Tháng"],
            ["list", "Danh sách"],
          ]}
        />
        <div className="actions">
          <Badge label="Lớp học" />
          <Badge label="Tự học" variant="success" />
        </div>
      </div>
      <div className="split">
        <Card padded={false} region="C" aria-label="C. Lịch học">
          <div className="calendar-toolbar">
            <div className="actions">
              <Button
                variant="ghost"
                aria-label="Khoảng trước"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={17} />
              </Button>
              <strong>
                {view === "month"
                  ? "Tháng " +
                    (anchor.getMonth() + 1) +
                    "/" +
                    anchor.getFullYear()
                  : formatDate(days[0]) + " – " + formatDate(days[6])}
              </strong>
              <Button
                variant="ghost"
                aria-label="Khoảng sau"
                onClick={() => move(1)}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor(new Date())}
            >
              Hôm nay
            </Button>
          </div>
          <ApiContent state={state}>
            {view === "week" ? (
              <>
                <WeeklyCalendar
                  days={days}
                  rows={rows}
                  onSelect={setSelected}
                />
                {!rows.length && (
                  <p className="hint" style={{ textAlign: "center" }}>
                    Chưa có lịch trong tuần này.
                  </p>
                )}
              </>
            ) : view === "month" ? (
              <div className="calendar-wrap">
                <div className="month-weekdays">
                  {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"].map((label) => <strong key={label}>{label}</strong>)}
                </div>
                <div className="month-grid">
                  {dates.map((d, i) => (
                    <div
                      key={i}
                      className={
                        "month-cell " +
                        (isToday(d) ? "today " : "") +
                        (d.getMonth() !== anchor.getMonth() ? "outside" : "")
                      }
                    >
                      <strong>{d.getDate()}</strong>
                      {rows
                        .filter(
                          (s) =>
                            formatDateISO(s.studyDate) === formatDateISO(d),
                        )
                        .map((s, j) => (
                          <button key={j} onClick={() => setSelected(s)}>
                            {formatTime(s.startTime)} {s.title || s.subjectName}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-content">
                {rows.length ? (
                  rows.map((s) => (
                    <button
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        marginBottom: 12,
                      }}
                      key={s.kind + s.id + s.studyDate}
                      onClick={() => setSelected(s)}
                    >
                      <small className="muted">{formatDate(s.studyDate)}</small>
                      <ScheduleItem item={s} />
                    </button>
                  ))
                ) : (
                  <EmptyState title="Chưa có lịch học" />
                )}
              </div>
            )}
          </ApiContent>
        </Card>
        <aside className="stack" data-region="E" aria-label="E. Lịch hôm nay và giờ trống">
          <Card title="Lớp hôm nay">
            <ApiContent state={state}>
              <strong>{rows.filter(s => isToday(s.studyDate) && s.kind === "class").length} tiết học</strong>
              {rows.filter(s => isToday(s.studyDate)).map(s => <div className="summary-line" key={s.kind + s.id + s.studyDate}><button className="task-title" onClick={() => setSelected(s)}>{s.title || s.subjectName}</button><small>{formatTime(s.startTime)}</small></div>)}
              <p className="hint">Số tiết được tính trong khoảng lịch đang xem.</p>
            </ApiContent>
          </Card>
          <Card title="Lớp trên lịch">
            <ApiContent state={state}>
              {rows.length ? (
                rows.slice(0, 5).map((s) => (
                  <div className="summary-line" key={s.kind + s.id + s.studyDate}>
                    <button
                      className="task-title"
                      onClick={() => setSelected(s)}
                    >
                      {s.title || s.subjectName}
                    </button>
                    <small>{formatTime(s.startTime)}</small>
                  </div>
                ))
              ) : (
                <p className="hint">Tuần này chưa có lớp học.</p>
              )}
            </ApiContent>
          </Card>
          <Card title="Tìm giờ trống">
            <div className="stack">
              <Field
                label="Ngày"
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
              />
              <Field
                label="Thời lượng (phút)"
                type="number"
                min="15"
                max="900"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <Button
                variant="outline"
                onClick={slots.refetch}
                disabled={slots.loading || !parseDate(slotDate) || duration < 15 || duration > 900}
              >
                <Clock size={14} />
                Tìm giờ trống
              </Button>
              {slots.loading || slots.response || slots.error ? (
                <ApiContent state={slots}>
                  {(() => {
                    const data =
                      slots.data?.freeSlots ??
                      slots.response?.data?.freeSlots ??
                      slots.data;
                    const list = Array.isArray(data) ? data : [];
                    return list.length ? (
                      <div className="slot-list">
                        {list.map((s, i) => (
                          <Badge
                            key={i}
                            variant="success"
                            label={
                              formatTime(
                                s.startTime || s.start_time || s.start,
                              ) +
                              " – " +
                              formatTime(s.endTime || s.end_time || s.end)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="hint">
                        Không tìm thấy khoảng trống phù hợp.
                      </p>
                    );
                  })()}
                </ApiContent>
              ) : null}
            </div>
          </Card>
          <Card title="Ghi chú">
            <p className="schedule-note">
              Chọn một lịch học để xem ghi chú, cập nhật trạng thái hoặc điều
              chỉnh lịch tự học.
            </p>
          </Card>
        </aside>
      </div>
      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Sửa lịch tự học" : "Thêm lịch học"}
      >
        {editor && (
          <ScheduleEditor
            event={editor}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              await reload();
            }}
          />
        )}
      </Modal>
      <Modal
        isOpen={!!selected}
        title={selected?.title || selected?.subjectName}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="stack">
            <Badge
              label={selected.kind === "study" ? "Tự học" : "Tiết trên lớp"}
            />
            <p>
              {formatDate(selected.studyDate)} ·{" "}
              {formatTime(selected.startTime)} - {formatTime(selected.endTime)}
            </p>
            <p className="muted">
              {selected.room} {selected.className}
            </p>
            <p className="pre-wrap">{selected.notes || "Chưa có ghi chú."}</p>
            {selected.kind === "study" && (
              <Field label="Trạng thái">
                <select
                  value={selected.status || "PLANNED"}
                  disabled={busy}
                  onChange={(e) => {
                    const status = e.target.value;
                    run(async () => {
                      await scheduleApi.changeStatus(selected.id, status);
                      setSelected((s) => ({ ...s, status }));
                      await reload();
                    });
                  }}
                >
                  {[
                    ["PLANNED", "Đã lên lịch"],
                    ["IN_PROGRESS", "Đang học"],
                    ["COMPLETED", "Hoàn thành"],
                    ["CANCELLED", "Đã hủy"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="form-actions">
              {selected.kind === "study" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditor(selected);
                    setSelected(null);
                  }}
                >
                  <Pencil size={14} />
                  Sửa
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => {
                  setDeleting(selected);
                  setSelected(null);
                }}
              >
                <Trash2 size={14} />
                Xóa
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
        item={deleting}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          run(async () => {
            await (deleting.kind === "study"
              ? scheduleApi.remove(deleting.id)
              : scheduleApi.removeClass(deleting.id));
            setDeleting(null);
            await reload();
          }, "Đã xóa lịch học")
        }
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { Plus, RefreshCw, List, LayoutGrid, Columns3, CalendarDays, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, ArrowUp, ArrowDown, ArrowDownWideNarrow, Diamond, CircleAlert, Search, FileText, MoreHorizontal, CodeXml, Sigma, BookOpen, Clock3, Target, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { taskApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { PageHeader, Card, Button, ApiContent, EmptyState, ProgressRing, Modal, ConfirmModal, useAction, ErrorState } from "../../components/common/ui";
import TaskEditor from "../../components/tasks/TaskEditor";
import TaskDetail from "../../components/tasks/TaskDetail";
import EduxTaskDetail from "../../components/tasks/EduxTaskDetail";
import { workspaceTasks, filterWorkspaceTasks, groupWorkspaceTasks, taskDueMeta, workspaceStats, upcomingWorkspaceTasks, workspaceDay } from "./taskWorkspace";
import "./Tasks.css";

const viewOptions = [["list", "Danh sách", List], ["subjects", "Theo môn", LayoutGrid], ["board", "Bảng", Columns3], ["calendar", "Lịch", CalendarDays]];
const priorityIcons = { URGENT: CircleAlert, HIGH: ArrowUp, MEDIUM: Diamond, LOW: ArrowDown };

function SubjectToken({ group, small = false }) {
  return <span className={"subject-token" + (small ? " is-small" : "")} data-tone={group.tone} aria-hidden="true">
    {group.token === "sigma" ? <Sigma size={25} /> : group.token === "csharp" ? <strong>C#</strong>
      : group.token === "python" ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-4 2-4 2v3h5v1H6s-4 0-4 5 4 5 4 5h2v-3s0-4 4-4h4s3 0 3-3V5s0-3-7-3Zm-2 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" /><path opacity=".7" d="M12 22c4 0 4-2 4-2v-3h-5v-1h7s4 0 4-5-4-5-4-5h-2v3s0 4-4 4H8s-3 0-3 3v3s0 3 7 3Zm2-2a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" /></svg>
        : group.token === "code" ? <CodeXml size={23} /> : <BookOpen size={22} />}
  </span>;
}
function SourcePill({ task }) {
  return <span className="task-item-source" data-source={task.source}>{task.source === "EDUX" ? "EDUX" : "Cá nhân"}</span>;
}
function PriorityPill({ task }) {
  const Icon = priorityIcons[task.priority];
  return <span className="task-item-priority" data-priority={task.priority || "NONE"}>{Icon && <Icon size={12} />}{task.priorityLabel}</span>;
}
function TaskLine({ task, busy, onOpen, onToggle, onEdit, onDelete }) {
  const due = taskDueMeta(task), complete = task.status === "COMPLETED";
  const dueOrigin = task.dueSource === "subject" ? "Hạn học phần" : task.dueSource === "exam" ? "Hạn bài kiểm tra" : "";
  return <div className={"task-item" + (complete ? " is-completed" : "") + (due.isOverdue ? " is-overdue" : "")}>
    <input type="checkbox" className="task-item-check" checked={complete} disabled={busy} aria-label={(complete ? "Đánh dấu chưa làm " : "Hoàn thành ") + task.title} onChange={() => onToggle(task)} />
    <div className="task-item-title"><button type="button" onClick={() => onOpen(task)} title={task.title}>{task.title}</button><FileText size={13} aria-hidden="true" /></div>
    <SourcePill task={task} />
    <span className="task-item-due" title={dueOrigin ? `${dueOrigin}: ${task.deadline || "Chưa đặt hạn"}${task.dueSource === "subject" ? " (áp dụng chung cho học phần)" : ""}` : task.deadline || "Chưa đặt hạn"} aria-label={dueOrigin ? `${dueOrigin}: ${due.label}${task.dueSource === "subject" ? " (áp dụng chung cho học phần)" : ""}` : undefined}>{due.dateKey && <CalendarDays size={13} aria-hidden="true" />}<span className="task-due-value">{due.label}{dueOrigin && <small className="task-due-origin">{dueOrigin}</small>}</span></span>
    <PriorityPill task={task} /><span className="task-item-status" data-status={due.status}>{due.statusLabel}</span>
    <details className="task-item-actions"><summary aria-label={"Thao tác " + task.title}><MoreHorizontal size={17} /></summary>
      <div className="tasks-task-menu"><button type="button" onClick={() => onOpen(task)}><ExternalLink size={13} />Xem chi tiết</button>
        {task.source === "PERSONAL" && <><button type="button" onClick={() => onEdit(task)}><Pencil size={13} />Sửa công việc</button><button type="button" className="is-danger" aria-label={"Xóa " + task.title} onClick={() => onDelete(task)}><Trash2 size={13} />Xóa công việc</button></>}
      </div>
    </details>
  </div>;
}
function TaskBoard({ tasks, busy, onOpen, onToggle, completedOnly }) {
  const columns = completedOnly ? [["COMPLETED", "Đã hoàn thành"]] : [["PENDING", "Chưa làm"], ["IN_PROGRESS", "Đang thực hiện"], ["OVERDUE", "Quá hạn"]];
  return <div className="tasks-board" data-completed-only={completedOnly} aria-label="Bảng công việc">{columns.map(([status, label]) => {
    const rows = tasks.filter(task => (taskDueMeta(task).isOverdue ? "OVERDUE" : task.status) === status);
    return <section key={status} className="tasks-board-column" data-status={status} aria-label={label}>
      <h2><span />{label}<small>{rows.length}</small></h2>
      {rows.map(task => <article className="tasks-board-card" key={task.key}>
        <div className="tasks-board-card-top"><SourcePill task={task} /><PriorityPill task={task} /></div>
        <button className="tasks-board-title" onClick={() => onOpen(task)}>{task.title}</button><p>{task.subject}</p>
        <div className="tasks-board-card-bottom"><span><CalendarDays size={12} />{taskDueMeta(task).label}</span><input type="checkbox" checked={task.status === "COMPLETED"} disabled={busy} aria-label={(task.status === "COMPLETED" ? "Đánh dấu chưa làm " : "Hoàn thành ") + task.title} onChange={() => onToggle(task)} /></div>
      </article>)}
      {!rows.length && <p className="tasks-column-empty">Chưa có công việc</p>}
    </section>;
  })}</div>;
}
function TaskCalendar({ tasks, onOpen }) {
  const today = workspaceDay();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1)), offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, monthNumber - 1, 1 - offset + index)).toISOString().slice(0, 10));
  const undated = tasks.filter(task => !workspaceDay(task.deadline));
  const move = delta => setMonth(new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7));
  return <section className="tasks-calendar" aria-label="Lịch công việc">
    <div className="tasks-calendar-heading"><h2>Tháng {monthNumber}, {year}</h2><div><button aria-label="Tháng trước" onClick={() => move(-1)}><ChevronLeft size={17} /></button><button onClick={() => setMonth(today.slice(0, 7))}>Hôm nay</button><button aria-label="Tháng sau" onClick={() => move(1)}><ChevronRight size={17} /></button></div></div>
    <div className="tasks-calendar-grid"><div className="tasks-calendar-weekdays">{["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"].map(label => <span key={label}>{label}</span>)}</div>
      <div className="tasks-calendar-days">{days.map(day => <div className={"tasks-calendar-day" + (!day.startsWith(month) ? " is-other-month" : "") + (day === today ? " is-today" : "")} key={day}>
        <strong>{Number(day.slice(-2))}</strong>{tasks.filter(task => workspaceDay(task.deadline) === day).map(task => <button data-source={task.source} className={task.status === "COMPLETED" ? "is-completed" : ""} key={task.key} onClick={() => onOpen(task)} title={task.title}>{task.title}</button>)}
      </div>)}</div>
    </div>
    {undated.length > 0 && <div className="tasks-calendar-undated"><h3>Chưa đặt hạn <small>{undated.length}</small></h3>{undated.map(task => <button key={task.key} onClick={() => onOpen(task)}><SourcePill task={task} />{task.title}</button>)}</div>}
  </section>;
}

export default function Tasks() {
  const state = useApi(taskApi.list), edux = useApi(taskApi.edux), detail = useApi(taskApi.eduxDetail, { immediate: false });
  const [params, setParams] = useSearchParams();
  const taskId = params.get("task"), eduxId = params.get("edux");
  const [view, setView] = useState("subjects"), [tab, setTab] = useState("pending"), [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState(""), [subjectFilter, setSubjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState(""), [statusFilter, setStatusFilter] = useState(""), [deadlineFilter, setDeadlineFilter] = useState(""), [sort, setSort] = useState("priority");
  const [expanded, setExpanded] = useState(() => new Set()), [editor, setEditor] = useState(null), [selected, setSelected] = useState(null), [deleting, setDeleting] = useState(null), [eduxDetail, setEduxDetail] = useState(null);
  const { run, busy } = useAction();
  const tasks = workspaceTasks(responseList(state.data, "tasks"), edux.error ? [] : responseList(edux.data, "assignments"));
  const filtered = filterWorkspaceTasks(tasks, { query, source: sourceFilter, subject: subjectFilter, priority: priorityFilter, status: statusFilter, date: deadlineFilter, tab, sort });
  const groups = groupWorkspaceTasks(filtered), allGroups = groupWorkspaceTasks(tasks), stats = workspaceStats(tasks);
  const attention = groupWorkspaceTasks(filterWorkspaceTasks(tasks, { tab: "pending", sort: "priority" })).slice(0, 4);
  const upcoming = upcomingWorkspaceTasks(tasks, 4);
  const hasFilters = Boolean(query || sourceFilter || subjectFilter || priorityFilter || statusFilter || deadlineFilter);
  useEffect(() => {
    if (params.get("action") !== "create") return;
    setEditor({});
    const next = new URLSearchParams(params); next.delete("action"); setParams(next, { replace: true });
  }, [params, setParams]);
  useEffect(() => {
    if (!taskId || !state.data) return;
    setSelected(workspaceTasks(responseList(state.data, "tasks")).find(task => String(task.id) === taskId) || null);
  }, [taskId, state.data]);
  useEffect(() => {
    if (!eduxId) return;
    setEduxDetail(eduxId); detail.execute(eduxId);
  }, [eduxId, detail.execute]);
  function closeDetail() {
    setSelected(null); setEduxDetail(null);
    if (taskId || eduxId) { const next = new URLSearchParams(params); next.delete("task"); next.delete("edux"); setParams(next, { replace: true }); }
  }
  async function reload() { await Promise.all([state.refetch(), edux.refetch()]); window.dispatchEvent(new Event("workspace-updated")); }
  function openTask(task) {
    if (task.source === "EDUX") { setEduxDetail(task.id); detail.execute(task.id); }
    else setSelected(task);
  }
  function toggleTask(task) {
    run(async () => {
      if (task.source === "EDUX") await taskApi.eduxStatus(task.id, task.status === "COMPLETED" ? "Chưa làm" : "Hoàn thành");
      else await taskApi.changeStatus(task.id, task.status === "COMPLETED" ? "PENDING" : "COMPLETED");
      await reload();
    });
  }
  function clearFilters() { setQuery(""); setSourceFilter(""); setSubjectFilter(""); setPriorityFilter(""); setStatusFilter(""); setDeadlineFilter(""); }
  function chooseTab(value) { setTab(value); setStatusFilter(""); }
  function chooseStatus(value) {
    setStatusFilter(value);
    if (value === "COMPLETED") setTab("completed");
    else if (tab === "completed") setTab("pending");
  }
  function chooseSubject(subject = "") {
    clearFilters(); setSubjectFilter(subject); setTab("pending"); setView("subjects");
    if (subject) setExpanded(previous => new Set(previous).add(`pending:${subject}`));
  }
  const rowProps = { busy, onOpen: openTask, onToggle: toggleTask, onEdit: setEditor, onDelete: setDeleting };
  const contentState = sourceFilter === "EDUX" ? edux : sourceFilter === "PERSONAL" ? state : {
    loading: state.data == null && edux.data == null && (state.loading || edux.loading),
    error: state.error && edux.error ? state.error : null,
    refetch: reload,
  };
  const subjectNames = [...new Set(tasks.map(task => task.subject))].sort((a, b) => a.localeCompare(b, "vi"));
  const allLoading = state.loading || edux.loading;
  const allFinished = tab === "pending" && !hasFilters && stats.pending === 0 && stats.completed > 0;
  const emptyTitle = hasFilters ? "Không có công việc khớp bộ lọc" : allFinished ? "Bạn đã hoàn thành mọi công việc" : tab === "completed" ? "Chưa có công việc đã hoàn thành" : "Không có công việc trong mục này";
  const emptyDescription = hasFilters ? "Thử thay đổi bộ lọc để tìm công việc của bạn." : allFinished ? "Các công việc đã xong được lưu riêng trong mục Đã hoàn thành." : tab === "completed" ? "Công việc sẽ chuyển vào đây khi bạn đánh dấu hoàn thành." : "Thêm công việc đầu tiên để bắt đầu sắp xếp việc học.";
  return <div className="page tasks-page"><div className="tasks-workspace"><div className="tasks-primary">
    <PageHeader eyebrow="TỪNG VIỆC NHỎ · BƯỚC TIẾN LỚN" title="Công việc" description="Quản lý tất cả công việc cá nhân và từ EDUX của bạn, được sắp xếp theo từng môn học."><Button onClick={() => setEditor({})}><Plus size={18} />Thêm công việc</Button></PageHeader>
    {taskId && !state.loading && !state.error && !tasks.some(task => String(task.id) === taskId) && <ErrorState title="Không tìm thấy công việc" error={new Error("Công việc có thể đã bị xóa hoặc không còn trong học kỳ hiện tại.")} />}
    <div className="tasks-controls" aria-label="B. Danh mục công việc" data-region="B">
      <div className="tasks-view-bar"><div className="tasks-view-switch" role="tablist" aria-label="Cách hiển thị công việc">{viewOptions.map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? "is-active" : ""} onClick={() => setView(value)}><Icon size={17} />{label}</button>)}</div>
        <div className="tasks-secondary-tools"><select className="tasks-subject-filter" aria-label="Lọc theo môn học" value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)}><option value="">Tất cả môn học</option>{subjectNames.map(subject => <option key={subject}>{subject}</option>)}</select><button type="button" className="tasks-refresh" aria-label="Làm mới công việc" disabled={busy || allLoading} onClick={reload}><RefreshCw size={15} /></button></div>
      </div>
      <section className="tasks-toolbar" aria-label="C. Bộ lọc nâng cao" data-region="C">
        <label className="tasks-search"><Search size={18} /><input aria-label="Tìm công việc..." placeholder="Tìm công việc..." value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="tasks-filter-field"><select aria-label="Lọc theo nguồn" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="">Nguồn: Tất cả</option><option value="PERSONAL">Nguồn: Cá nhân</option><option value="EDUX">Nguồn: EDUX</option></select><ChevronDown size={13} /></label>
        <label className="tasks-filter-field"><select aria-label="Lọc theo ưu tiên" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option value="">Ưu tiên: Tất cả</option>{[["URGENT", "Khẩn cấp"], ["HIGH", "Cao"], ["MEDIUM", "Trung bình"], ["LOW", "Thấp"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={13} /></label>
        <label className="tasks-filter-field"><select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={event => chooseStatus(event.target.value)}><option value="">Trạng thái: Tất cả</option>{[["PENDING", "Chưa làm"], ["IN_PROGRESS", "Đang làm"], ["COMPLETED", "Hoàn thành"], ["OVERDUE", "Quá hạn"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={13} /></label>
        <label className="tasks-filter-field tasks-date-filter"><Calendar size={15} /><span>Ngày: {deadlineFilter ? deadlineFilter.split("-").reverse().slice(0, 2).join("/") : "Tất cả"}</span><input type="date" aria-label="Lọc theo deadline" value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value)} /><ChevronDown size={13} /></label>
        <label className="tasks-filter-field tasks-sort-field"><ArrowDownWideNarrow size={15} /><select aria-label="Sắp xếp công việc" value={sort} onChange={event => setSort(event.target.value)}><option value="priority">Ưu tiên + hạn</option><option value="deadline">Hạn gần nhất</option><option value="title">Tên công việc</option></select></label>
      </section>
      <div className="tasks-status-strip"><div className="tasks-status-tabs" role="tablist" aria-label="Trạng thái và thời hạn công việc">{[["pending", "Chưa hoàn thành", stats.pending], ["today", "Hôm nay", stats.today], ["upcoming", "Sắp tới", stats.upcoming], ["completed", "Đã hoàn thành", stats.completed]].map(([value, label, count]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => chooseTab(value)}>{label}<span aria-hidden="true"> ({count})</span></button>)}</div>{hasFilters && <button className="tasks-clear-filters" type="button" onClick={clearFilters}>Xóa bộ lọc</button>}</div>
    </div>
    {state.error && sourceFilter !== "PERSONAL" && <p className="tasks-source-notice" aria-live="polite">Chưa tải được công việc cá nhân. <button onClick={state.refetch}>Thử lại</button></p>}
    {edux.error && sourceFilter !== "EDUX" && <p className="tasks-source-notice">{Number(edux.error.response?.status) === 401 ? "Kết nối EDUX để xem thêm bài tập của bạn." : "Chưa tải được bài tập EDUX."} <Link to="/sync">Đến Đồng bộ <ArrowRight size={12} /></Link>{Number(edux.error.response?.status) !== 401 && <button onClick={edux.refetch}>Thử lại</button>}</p>}
    {edux.loading && sourceFilter !== "EDUX" && <p className="tasks-source-notice" role="status">Đang tải thêm bài tập EDUX…</p>}
    <section className="tasks-content" role="region" aria-label="D. Danh sách công việc" data-region="D"><ApiContent state={contentState}>
      {filtered.length ? view === "subjects" ? <div className="tasks-subjects">{groups.map(group => {
        const expansionKey = `${tab}:${group.key}`, isCollapsed = !expanded.has(expansionKey);
        const overall = allGroups.find(item => item.key === group.key) || group;
        const summary = [`${group.tasks.length} công việc ${tab === "completed" ? "đã hoàn thành" : "cần làm"}`, ...(group.overdue ? [`${group.overdue} quá hạn`] : []), ...(group.inProgress ? [`${group.inProgress} đang thực hiện`] : [])];
        return <section className="tasks-subject-group" key={group.key} data-tone={group.tone}>
          <button type="button" className="tasks-subject-header" aria-label={(isCollapsed ? "Mở rộng môn " : "Thu gọn môn ") + group.subject} aria-expanded={!isCollapsed} onClick={() => setExpanded(previous => { const next = new Set(previous); next.has(expansionKey) ? next.delete(expansionKey) : next.add(expansionKey); return next; })}>
            <SubjectToken group={group} /><span className="tasks-subject-summary"><strong>{group.subject}</strong><small>{summary.join(" · ")}</small></span><span className="tasks-subject-progress" title="Tiến độ toàn bộ công việc của môn học"><span className="tasks-mini-track"><span style={{ width: `${overall.completed / overall.tasks.length * 100}%` }} /></span><small>{overall.completed}/{overall.tasks.length} hoàn thành</small></span>{isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {!isCollapsed && <div className="tasks-subject-body">{group.tasks.map(task => <TaskLine key={task.key} task={task} {...rowProps} />)}</div>}
        </section>;
      })}</div> : view === "board" ? <TaskBoard tasks={filtered} completedOnly={tab === "completed"} {...rowProps} /> : view === "calendar" ? <TaskCalendar tasks={filtered} onOpen={openTask} /> : <div className="tasks-list">{filtered.map(task => <TaskLine key={task.key} task={task} {...rowProps} />)}</div>
        : <Card className="tasks-empty"><EmptyState title={emptyTitle} description={emptyDescription} mascot="fox-quiz-success.png" action={<Button size="sm" variant="outline" onClick={hasFilters ? clearFilters : allFinished ? () => chooseTab("completed") : tab === "completed" ? () => chooseTab("pending") : () => setEditor({})}>{hasFilters ? "Xóa bộ lọc" : allFinished ? "Xem đã hoàn thành" : tab === "completed" ? "Xem việc chưa hoàn thành" : "Thêm công việc"}</Button>} /></Card>}
    </ApiContent></section>
  </div>
  <aside className="tasks-insights" data-region="E" aria-label="E. Tiến độ và thống kê">
    <Card className="tasks-insight-card tasks-progress-card" title="Tiến độ tuần này" action={<Link to="/statistics">Xem chi tiết <ArrowRight size={13} /></Link>}>
      <div className="tasks-week-progress"><ProgressRing value={stats.week.percent} /><div className="tasks-progress-legend">{[["completed", "Đã hoàn thành", stats.week.completed], ["in-progress", "Đang thực hiện", stats.week.inProgress], ["pending", "Chưa làm", stats.week.pending]].map(([key, label, value]) => <div key={key}><i data-status={key} /><span>{label}</span><strong>{state.loading ? "—" : value}</strong></div>)}</div></div>
      <div className="tasks-progress-message"><Target size={26} /><p>{stats.week.total ? <><strong>{stats.week.percent > 0 ? `Tuyệt vời! Bạn đã hoàn thành ${stats.week.percent}%` : "Một việc nhỏ, một bước tiến mới."}</strong><span>{stats.week.percent > 0 ? "công việc trong tuần này." : "Cùng hoàn thành công việc đầu tiên nhé!"}</span></> : <><strong>Sẵn sàng cho một tuần hiệu quả!</strong><span>Công việc có hạn trong tuần sẽ hiển thị ở đây.</span></>}</p></div>
    </Card>
    <Card className="tasks-insight-card tasks-attention-card" title="Môn học cần chú ý" action={<button type="button" onClick={() => chooseSubject()}>Xem tất cả <ArrowRight size={13} /></button>}>
      {attention.length ? attention.map(group => <button type="button" className="tasks-attention-row" key={group.key} onClick={() => chooseSubject(group.subject)} aria-label={"Xem công việc môn " + group.subject}><SubjectToken group={group} small /><span className="tasks-attention-info"><strong>{group.subject}</strong><small>{group.tasks.length - group.completed} công việc cần làm</small></span><span className="tasks-attention-count is-overdue" title="Quá hạn">{group.overdue}</span><span className="tasks-attention-count" title="Đang thực hiện">{group.inProgress}</span><ChevronRight size={15} /></button>) : <p className="tasks-insight-empty">{allLoading ? "Đang tải môn học…" : state.error || edux.error ? "Chưa có đủ dữ liệu để tổng hợp môn học." : "Bạn đã hoàn thành mọi công việc. Thật tuyệt!"}</p>}
    </Card>
    <Card className="tasks-insight-card tasks-upcoming-card" title="Lịch sắp tới" action={<button type="button" onClick={() => { clearFilters(); setTab("upcoming"); }}>Xem tất cả <ArrowRight size={13} /></button>}>
      {upcoming.length ? upcoming.map(task => { const due = taskDueMeta(task); return <button type="button" className="tasks-upcoming-row" key={task.key} onClick={() => openTask(task)}><span className="tasks-upcoming-date" data-status={due.status}><small>{due.status === "today" ? "HÔM NAY" : due.status === "tomorrow" ? "NGÀY MAI" : "SẮP TỚI"}</small><strong>{due.dateKey.split("-").reverse().slice(0, 2).join("/")}</strong></span><span className="tasks-upcoming-info"><strong>{task.title}</strong><small>{task.subject} · {task.source === "EDUX" ? "EDUX" : "Cá nhân"}</small></span><span className="tasks-upcoming-time"><Clock3 size={14} />{due.time || "Cả ngày"}</span></button>; }) : <p className="tasks-insight-empty">Chưa có công việc sắp đến hạn.</p>}
    </Card>
  </aside></div>
  <Modal isOpen={!!editor} onClose={() => setEditor(null)} title={editor?.id ? "Sửa công việc" : "Thêm công việc"}>{editor && <TaskEditor task={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await reload(); }} />}</Modal>
  <Modal isOpen={!!selected} onClose={closeDetail} title={selected?.title}>{selected && <TaskDetail key={selected.key || selected.id} task={tasks.find(task => task.key === selected.key) || selected} onUpdate={reload} onEdit={() => { setEditor(selected); closeDetail(); }} />}</Modal>
  <ConfirmModal item={deleting} busy={busy} onClose={() => setDeleting(null)} onConfirm={() => run(async () => { await taskApi.remove(deleting.id); setDeleting(null); await reload(); }, "Đã xóa công việc")} />
  <Modal isOpen={!!eduxDetail} onClose={closeDetail} title="Bài tập EDUX"><ApiContent state={{ ...detail, refetch: () => detail.execute(eduxDetail) }}>{detail.data && <EduxTaskDetail key={eduxDetail} assignment={detail.data.assignment || detail.data} onUpdate={async () => { await detail.execute(eduxDetail); await edux.refetch(); window.dispatchEvent(new Event("workspace-updated")); }} />}</ApiContent></Modal>
  </div>;
}

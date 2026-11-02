import { useEffect, useState } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import {
  Clock,
  BookOpen,
  FileText,
  ListTodo,
  CalendarDays,
  ArrowUpRight,
  Sparkles,
  Star,
} from "lucide-react";
import { Card, Badge, EmptyState, ApiContent, useAction } from "../common/ui";
import {
  formatDate,
  formatTime,
  formatDateTime,
  daysAgo,
  parseDate,
  formatDateISO,
} from "../../utils/date";
import { mapTask } from "../../utils/taskAdapter";
import { mapSchedule } from "../../utils/scheduleAdapter";
import { mapExam } from "../../utils/examAdapter";
import { taskApi } from "../../api";
import foxAssets from "../../assets/foxAssets";

export function GreetingBanner({ profile = {} }) {
  const inRouter = useInRouterContext();
  const HeroLink = inRouter ? Link : "a";
  const hour = new Date().getHours(),
    greeting = hour < 12 ? "buổi sáng" : hour < 18 ? "buổi chiều" : "buổi tối";
  const name = String(profile?.full_name || profile?.fullName || "bạn")
    .trim()
    .split(" ")
    .at(-1);
  return (
    <section className="hero" aria-label="Lời chào và ngày hiện tại">
      <div className="hero-content">
        <div className="hero-eyebrow"><Sparkles size={13} /> MỖI NGÀY MỘT CHÚT TIẾN BỘ</div>
        <h1>
          Chào {greeting}, {name} 👋
        </h1>
        <p>Một chút tập trung hôm nay. Một phiên bản tốt hơn ngày mai.</p>
        <div className="hero-cta-row">
          <HeroLink {...(inRouter ? { to: "/learning" } : { href: "/learning" })} className="btn btn-primary">Bắt đầu học thôi <ArrowUpRight size={16} /></HeroLink>
          <HeroLink {...(inRouter ? { to: "/schedule" } : { href: "/schedule" })} className="hero-secondary-link">Xem lịch của bạn <ArrowUpRight size={15} /></HeroLink>
        </div>
        <div className="hero-date">
          <CalendarDays size={13} />
          {formatDate(new Date(), { weekday: "long", month: "long" })}
        </div>
      </div>
      <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
      <span className="hero-floating-star" aria-hidden="true"><Star size={29} /></span>
      <span className="hero-floating-note" aria-hidden="true"><BookOpen size={20} /> Learn. Grow. Shine.</span>
      <img
        className="hero-image"
        src={foxAssets["fox-wave.png"]}
        alt="Cáo chào bạn"
      />
    </section>
  );
}
export function StatCard({ icon: Icon = BookOpen, label, value, detail, decorative = false }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <strong>{value ?? "—"}</strong>
        <p>{label}</p>
        {detail && <small>{detail}</small>}
      </div>
      {decorative && <ArrowUpRight className="stat-decoration" size={17} aria-hidden="true" />}
    </div>
  );
}
export function ScheduleItem({ item, showTiming = false, now = new Date() }) {
  const s = item.subjectName !== undefined ? item : mapSchedule(item);
  const date = formatDateISO(s.studyDate || now);
  const begins = parseDate(`${date}T${formatTime(s.startTime)}`), ends = parseDate(`${date}T${formatTime(s.endTime)}`);
  const timing = !showTiming || !begins || !ends ? null : now >= ends ? ["Đã kết thúc", "default"] : now >= begins ? ["Đang diễn ra", "success"] : ["Sắp diễn ra", "warning"];
  return (
    <div className="schedule-item">
      <div className="schedule-time">
        {formatTime(s.startTime)} - {formatTime(s.endTime)}
      </div>
      <div className="schedule-detail">
        <strong>{s.title || s.subjectName}</strong>
        <small>
          {[s.className, s.room].filter(Boolean).join(" · ") || "Lịch tự học"}
        </small>
      </div>
      <Badge
        label={timing?.[0] || (s.kind === "study" ? "Tự học" : "Lớp học")}
        variant={timing?.[1] || (s.kind === "study" ? "success" : "primary")}
      />
    </div>
  );
}
export function TodaySchedule({ rows = [], state }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  return (
    <Card
      region="C"
      title="Lịch học hôm nay"
      action={<Link to="/schedule">Xem tất cả ↗</Link>}
    >
      <ApiContent state={state}>
        {rows.length ? (
          rows.map((s, i) => (
            <ScheduleItem key={s.timetable_id || s.id || i} item={s} showTiming now={now} />
          ))
        ) : (
          <EmptyState
            title="Chưa có lịch học hôm nay"
            description="Dành một chút thời gian để tự học nhé."
          />
        )}
      </ApiContent>
    </Card>
  );
}
export function TaskCard({ task, onToggle, onOpen, controls, busy }) {
  const t = task.subject !== undefined ? task : mapTask(task);
  return (
    <div
      className={"task-row " + (t.status === "COMPLETED" ? "completed" : "")}
    >
      <input
        aria-label={"Hoàn thành " + t.title}
        type="checkbox"
        checked={t.status === "COMPLETED"}
        disabled={busy}
        onChange={() => onToggle(t)}
      />
      <div className="task-info">
        {onOpen ? (
          <button className="task-title" onClick={() => onOpen(t)}>
            {t.title}
          </button>
        ) : (
          <span className="task-title">{t.title}</span>
        )}
        <div className="task-meta">
          <span>{t.subject}</span>
          <Badge
            label={t.statusLabel}
            variant={t.status === "COMPLETED" ? "success" : "default"}
          />
        </div>
        <p className="deadline">Hạn: {formatDateTime(t.deadline)}</p>
      </div>
      <div className="task-controls">
        <Badge
          label={t.priorityLabel}
          variant={
            t.priority === "URGENT"
              ? "danger"
              : t.priority === "HIGH"
                ? "warning"
                : "info"
          }
        />
        {controls}
      </div>
    </div>
  );
}
export function TaskList({ rows = [], onUpdate, onOpen, limit }) {
  const { run, busy } = useAction();
  return rows.length ? (
    rows.slice(0, limit || rows.length).map((task, i) => (
      <TaskCard
        task={task}
        key={task.assignment_id || task.id || i}
        busy={busy}
        onOpen={onOpen}
        onToggle={(t) =>
          run(async () => {
            await taskApi.changeStatus(
              t.id,
              t.status === "COMPLETED" ? "PENDING" : "COMPLETED",
            );
            await onUpdate?.();
            window.dispatchEvent(new Event("workspace-updated"));
          })
        }
      />
    ))
  ) : (
    <EmptyState
      title="Chưa có công việc nào 🎉"
      description="Bạn đã xử lý hết công việc hiện tại."
      mascot="fox-quiz-success.png"
    />
  );
}
export function UpcomingExamCard({ item }) {
  const exam = item.subjectName !== undefined ? item : mapExam(item),
    d = parseDate(exam.examDate),
    days = daysAgo(exam.examDate);
  return (
    <div className="exam-mini">
      <div className="exam-date-chip">
        <strong>{d?.getDate() || "—"}</strong>
        <small>THÁNG {d ? d.getMonth() + 1 : "—"}</small>
      </div>
      <div>
        <h3>{exam.subjectName || "Kỳ thi"}</h3>
        <p>
          {formatTime(exam.startTime)} · {exam.room || "Chưa có phòng"}
        </p>
        <Badge
          variant={days < 4 ? "warning" : "primary"}
          label={
            days < 0
              ? "Đã diễn ra"
              : days === 0
                ? "Hôm nay"
                : Number.isFinite(days) ? "Còn " + days + " ngày" : "Chưa có ngày thi"
          }
        />
      </div>
    </div>
  );
}
export const statIcons = { BookOpen, FileText, Clock, ListTodo };

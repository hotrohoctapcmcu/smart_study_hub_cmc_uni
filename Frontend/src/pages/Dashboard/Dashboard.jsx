import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, CalendarDays, NotebookPen, ListTodo, Timer, Bot, ChevronRight } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { dashboardApi, documentApi, progressApi, taskApi, timemapApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { Card, ApiContent } from "../../components/common/ui";
import {
  GreetingBanner,
  StatCard,
  TodaySchedule,
  TaskList,
  UpcomingExamCard,
  statIcons,
} from "../../components/dashboard/Widgets";
import ProgressChart from "../../components/charts/ProgressChart";
import { mapProgress, mapTimeBlocks, dailyStudyHours, weeklyActivity } from "../../utils/progressAdapter";
import { formatDateISO, startOfWeek, addDays, weekDays } from "../../utils/date";
import { mapTask } from "../../utils/taskAdapter";
import foxAssets from "../../assets/foxAssets";
import "../../styles/dashboard-refresh.css";

export default function Dashboard() {
  const dashboard = useApi(dashboardApi.getDashboard),
    documents = useApi(documentApi.list),
    progress = useApi(progressApi.getProgress),
    taskStats = useApi(taskApi.list),
    timemap = useApi(timemapApi.getTimemap);
  const data = dashboard.data || {},
    p = mapProgress(progress.data || {});
  const studyHours = p.dailyHours.length ? p.dailyHours : dailyStudyHours(mapTimeBlocks(timemap.data));
  const taskRows = responseList(taskStats.data, 'tasks');
  const chartData = studyHours.length || taskRows.length ? weeklyActivity(weekDays(new Date()), studyHours, taskRows) : [];
  const chartState = progress.loading || p.dailyHours.length ? progress : timemap;
  const from = formatDateISO(startOfWeek()), to = formatDateISO(addDays(startOfWeek(), 6));
  const weeklyTasks = taskRows.map(mapTask).filter(t => t.deadline?.slice(0,10) >= from && t.deadline?.slice(0,10) <= to);
  const weeklyRate = weeklyTasks.length ? Math.round(weeklyTasks.filter(t => t.status === 'COMPLETED').length / weeklyTasks.length * 100) : 0;
  const schedules = Array.isArray(data.todaySchedules)
      ? data.todaySchedules
      : [],
    tasks = Array.isArray(data.upcomingDeadlines) ? data.upcomingDeadlines : [],
    exams = Array.isArray(data.upcomingExams) ? data.upcomingExams : [];
  const stats = [
    [
      "Môn học hôm nay",
      new Set(schedules.map((s) => s.subject_id || s.subject_name)).size,
      statIcons.BookOpen,
    ],
    [
      "Công việc cần làm",
      tasks.filter((t) => t.status !== "COMPLETED").length,
      statIcons.ListTodo,
    ],
    [
      "Tiến độ tuần này",
      taskStats.error || taskStats.loading ? "—" : weeklyRate + "%",
      statIcons.Clock,
    ],
    [
      "Tài liệu học tập",
      documents.error || documents.loading ? "—" : responseList(documents.data, "documents").length,
      statIcons.FileText,
    ],
  ];
  return (
    <div className="page dashboard-page">
      <div className="dashboard-intro" data-region="A" aria-label="A · Tổng quan học tập">
        <div><span className="dashboard-kicker">YOUR LITTLE SPACE TO GROW</span><h2>Tổng quan học tập<span className="dashboard-title-dot">.</span></h2><p>Mọi thứ bạn cần cho một ngày học hiệu quả.</p></div>
        <Link className="dashboard-ai-shortcut" to="/ai"><Sparkles size={16} /><span>Học thông minh hơn với AI</span><ArrowUpRight size={15} /></Link>
      </div>
      <GreetingBanner profile={data.profile} />
      <div className="stats-grid" data-region="B" aria-label="B · Thống kê nhanh">
        {stats.map(([label, value, icon]) => (
          <StatCard
            key={label}
            label={label}
            value={dashboard.loading || dashboard.error ? "—" : value}
            icon={icon}
            decorative
          />
        ))}
      </div>
      <div className="dashboard-section-label"><span>NGÀY HỌC CỦA BẠN</span><span>Sắp xếp một chút, tiến xa hơn một chút</span></div>
      <div className="dashboard-grid">
        <TodaySchedule rows={schedules} state={dashboard} />
        <Card
          className="dashboard-tasks-card"
          region="D"
          title="Công việc cần làm"
          action={<Link to="/tasks">Xem tất cả ↗</Link>}
        >
          <ApiContent state={dashboard}>
            <TaskList rows={tasks} limit={4} onUpdate={async () => { await dashboard.refetch(); await taskStats.refetch(); }} />
          </ApiContent>
        </Card>
        <Card
          className="dashboard-chart-card"
          region="E"
          title="Tiến độ tuần này"
          action={<Link to="/statistics">Xem chi tiết ↗</Link>}
        >
          <ApiContent state={chartState}>
            <div className="dashboard-activity-legend"><span><i />Thời gian học (giờ)</span>{!taskStats.error && <span><i />Công việc hoàn thành</span>}</div>
            <ProgressChart data={chartData} showTasks={!taskStats.error && !taskStats.loading} />
          </ApiContent>
        </Card>
        <Card
          className="dashboard-exams-card"
          region="F"
          title="Kỳ thi sắp tới"
          action={<Link to="/exams">Xem tất cả ↗</Link>}
        >
          <ApiContent state={dashboard} empty={!exams.length}>
            {exams.slice(0, 3).map((e, i) => (
              <UpcomingExamCard item={e} key={e.exam_id || i} />
            ))}
          </ApiContent>
        </Card>
      </div>
      <div className="dashboard-bottom-grid" data-region="G" aria-label="G · Thao tác nhanh">
        <section className="dashboard-focus-card">
          <div><span className="dashboard-focus-eyebrow"><Timer size={14} /> TIME TO FOCUS</span><h2>Thế giới có thể chờ.<br />Giờ là lúc của bạn.</h2><p>Dành một khoảng thời gian thật trọn vẹn cho việc học.</p><Link to="/learning?tab=pomodoro" className="dashboard-focus-link">Bắt đầu tập trung <ArrowUpRight size={16} /></Link></div>
          <img src={foxAssets["fox-pomodoro.png"]} alt="" loading="lazy" />
        </section>
        <section className="card dashboard-shortcuts-card">
          <div className="card-heading"><h2>Một chạm, sẵn sàng học</h2><Sparkles size={17} /></div>
          <div className="dashboard-shortcuts">
            {[["/tasks?action=create", ListTodo, "Thêm công việc", "Một bước nhỏ cho mục tiêu lớn"], ["/schedule?action=create", CalendarDays, "Tạo lịch tự học", "Dành chỗ cho điều quan trọng"], ["/textbook", NotebookPen, "Mở Vở ghi", "Viết nên những điều bạn học"], ["/ai", Bot, "Hỏi AI Tutor", "Gỡ rối những câu hỏi khó"]].map(([path, Icon, title, description]) => <Link to={path} key={path}><span className="shortcut-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16} /></Link>)}
          </div>
        </section>
      </div>
    </div>
  );
}

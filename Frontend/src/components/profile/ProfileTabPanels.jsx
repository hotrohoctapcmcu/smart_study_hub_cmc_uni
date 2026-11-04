import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Medal,
  Settings,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingSkeleton, Modal } from "../common/ui";
import { buildSemesterRows, getScoreTone } from "./profileData";
import { progressApi, scheduleApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList } from "../../api/apiClient";
import { formatDateISO, addDays } from "../../utils/date";
import { expandClassSchedules } from "../../utils/scheduleAdapter";
import { mapProgress } from "../../utils/progressAdapter";

export function SubjectGrid({ state, courses, programName }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [block, setBlock] = useState('');
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const visible = courses.filter(course => (!search.trim() || normalize(`${course.code} ${course.name}`).includes(normalize(search.trim())))
    && (!status || course.status === status) && (!block || course.block === block));
  const blocks = [...new Set(courses.map(course => course.block).filter(Boolean))];
  if (state.loading) return <div className="profile-card-grid"><LoadingSkeleton /><LoadingSkeleton /><LoadingSkeleton /></div>;
  if (state.error) return <ErrorState error={state.error} onRetry={state.refetch} title="Không thể tải danh sách môn học" />;
  if (!courses.length) return <EmptyState title="Chưa có môn học" description="Môn học sẽ xuất hiện sau lần đồng bộ tiếp theo." />;
  return (
    <section className="profile-tab-section" aria-labelledby="subjects-heading">
      <div className="profile-section-heading"><div><span>MÔN HỌC CỦA BẠN</span><h2 id="subjects-heading">Toàn bộ học phần</h2><p>{programName ? `${programName}. ` : ''}Bao gồm các môn đã học, đang học và chưa bắt đầu.</p></div></div>
      <div className="profile-subject-filters">
        <label>Tìm học phần<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc mã học phần" /></label>
        <label>Trạng thái học phần<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{[...new Set(courses.map(course => course.status))].map(value => <option key={value}>{value}</option>)}</select></label>
        {blocks.length > 0 && <label>Khối kiến thức<select value={block} onChange={event => setBlock(event.target.value)}><option value="">Tất cả khối</option>{blocks.map(value => <option key={value}>{value}</option>)}</select></label>}
      </div>
      <p className="profile-subject-count" role="status">Hiển thị {visible.length} / {courses.length} học phần</p>
      {!visible.length && <EmptyState title="Không tìm thấy học phần phù hợp" description="Thử đổi tên, mã hoặc bộ lọc học phần." />}
      <div className="subject-grid">
        {visible.map((course, index) => {
          const tone = getScoreTone(course.score);
          return (
            <article className="subject-profile-card" key={course.id || `${course.code}-${index}`}>
              <div className="subject-card-top">
                <span className={`subject-symbol subject-symbol-${(index % 3) + 1}`}><BookOpen size={20} /></span>
                <span className={`subject-state ${course.status === "Đang học" ? "is-learning" : ""}`}>{course.status}</span>
              </div>
              <div><h3>{course.name}</h3><p className="subject-code">{course.code || "Chưa có mã môn"}</p></div>
              <div className="subject-meta"><span>Giảng viên <strong>{course.instructor}</strong></span><span>Tín chỉ <strong>{course.credit ?? "—"}</strong></span>{course.block && <span>Khối kiến thức <strong>{course.block}</strong></span>}</div>
              <div className="subject-progress-copy"><span>Tiến độ</span><strong>{course.progress === null ? "Chưa cập nhật" : `${course.progress}%`}</strong></div>
              <div className="subject-progress"><span style={{ width: `${course.progress || 0}%` }} /></div>
              <div className="subject-card-footer">
                <div><small>Điểm hiện tại</small><strong className={`grade-score grade-score-${tone}`}>{course.score ?? "—"}</strong></div>
                <button type="button" className="profile-outline-link" onClick={() => setSelected(course)}>Xem môn học <ArrowRight size={14} /></button>
              </div>
            </article>
          );
        })}
      </div>
      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || "Chi tiết môn học"}>
        {selected && <div className="stack">
          <div className="subject-meta"><span>Mã môn <strong>{selected.code || "—"}</strong></span><span>Giảng viên <strong>{selected.instructor}</strong></span><span>Tín chỉ <strong>{selected.credit ?? "—"}</strong></span><span>Học kỳ <strong>{selected.semester || "Chưa cập nhật"}</strong></span><span>Điểm hiện tại <strong>{selected.score ?? "—"}</strong></span><span>Trạng thái <strong>{selected.status}</strong></span>{selected.block && <span>Khối kiến thức <strong>{selected.block}</strong></span>}{selected.portalStatus && <span>Kết quả trên IU <strong>{selected.portalStatus}</strong></span>}</div>
          <Link className="btn btn-primary" to="/learning">Đến không gian học tập <ArrowRight size={14} /></Link>
        </div>}
      </Modal>
    </section>
  );
}

export function SemesterTimeline({ grades, compact, academicSummary }) {
  const semesters = buildSemesterRows(grades, academicSummary);
  if (!semesters.length) return <EmptyState title="Chưa có dữ liệu kỳ học" description="Thông tin học kỳ sẽ được tổng hợp từ bảng điểm." />;
  return (
    <section className={`profile-tab-section ${compact ? "semester-summary" : ""}`} aria-labelledby="semesters-heading">
      <div className="profile-section-heading"><div><span>HÀNH TRÌNH HỌC TẬP</span><h2 id="semesters-heading">Các kỳ học</h2><p>Nhìn lại kết quả theo từng chặng của năm học.</p></div></div>
      <div className="semester-timeline">
        {semesters.map((semester, index) => (
          <article className="semester-item" key={semester.key}>
            <div className="semester-marker"><span>{index + 1}</span></div>
            <div className="semester-card">
              <div className="semester-card-heading"><div><span>{semester.academicYear || "Năm học chưa cập nhật"}</span><h3>{/^\d+$/.test(semester.semester) ? `Học kỳ ${semester.semester}` : semester.semester}</h3></div><strong>{semester.gpa4 == null ? '—' : semester.gpa4.toFixed(2)} / 4</strong></div>
              <div className="semester-metrics">
                <span><small>Số môn</small><strong>{semester.subjects}</strong></span>
                <span><small>Tín chỉ</small><strong>{semester.credits ?? "—"}</strong></span>
                <span><small>Môn đạt</small><strong>{semester.passed}</strong></span>
                <span><small>Chưa đạt</small><strong>{semester.failed}</strong></span>
                <span><small>Trung bình hệ 10</small><strong>{semester.gpa == null ? '—' : semester.gpa.toFixed(2)}</strong></span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Achievements({ stats, goal }) {
  const progress = useApi(progressApi.getProgress);
  const activity = progress.data ? mapProgress(progress.data) : null;
  const hours = activity?.totalHours || 0;
  const achievements = [
    [Trophy, "Kết quả nổi bật", stats.gpaText === "—" ? "Đang chờ điểm số đầu tiên" : `Điểm tích lũy ${stats.gpaText}/10`, "gold", stats.gpa >= 8],
    [CheckCircle2, "Chinh phục môn học", `${stats.passed} môn đã đạt`, "mint", stats.passed > 0],
    [Flame, "Chuỗi ngày học", "Duy trì học mỗi ngày để mở huy hiệu", "pink", false],
    [Target, "Bám sát mục tiêu", `${Math.min(100, Math.round((stats.gpa / goal) * 100) || 0)}% mục tiêu ${goal.toFixed(1)}/10`, "blue", stats.gpa >= goal],
    [Clock3, "Giờ học tập trung", progress.loading ? "Đang tải thời gian học..." : `${hours.toFixed(1)} giờ học đã ghi nhận`, "violet", hours >= 10],
    [Sparkles, "Bạn đồng hành AI", "Khám phá và học cùng AI Tutor", "peach", false],
  ];
  return (
    <section className="profile-tab-section" aria-labelledby="achievements-heading">
      <div className="profile-section-heading"><div><span>DẤU ẤN CỦA BẠN</span><h2 id="achievements-heading">Thành tích học tập</h2><p>Những cột mốc nhỏ tạo nên một hành trình lớn.</p></div></div>
      <div className="achievement-grid">
        {achievements.map(([Icon, title, description, tone, unlocked]) => (
          <article className={`achievement-card achievement-${tone} ${unlocked ? "" : "achievement-locked"}`} key={title}>
            <span className="achievement-icon"><Icon size={24} /></span>
            <div><h3>{title}</h3><p>{description}</p></div>
            <Medal className="achievement-watermark" size={58} />
          </article>
        ))}
      </div>
      {progress.error && <ErrorState error={progress.error} onRetry={progress.refetch} title="Chưa thể tải thời gian học" />}
    </section>
  );
}

export function SchedulePanel() {
  const state = useApi(scheduleApi.list);
  const from = formatDateISO();
  const rows = expandClassSchedules(responseList(state.data), from, formatDateISO(addDays(new Date(), 7)))
    .sort((a, b) => `${a.study_date} ${a.start_time}`.localeCompare(`${b.study_date} ${b.start_time}`));
  return (
    <section className="profile-tab-section" aria-labelledby="schedule-heading">
      <div className="profile-section-heading"><div><span>LỊCH HỌC CÁ NHÂN</span><h2 id="schedule-heading">Lịch học 7 ngày tới</h2><p>Chủ động sắp xếp thời gian cho tuần học của bạn.</p></div><CalendarDays size={23} /></div>
      {state.loading ? <LoadingSkeleton /> : state.error ? <ErrorState error={state.error} onRetry={state.refetch} title="Không thể tải lịch học" /> : !rows.length ? <EmptyState title="Chưa có lịch học trong 7 ngày tới" description="Bạn có thể thêm lịch tự học trong trang Lịch học." /> : <div className="profile-schedule-list">{rows.map((row, index) => <article className="profile-schedule-row" key={`${row.timetable_id}-${index}`}><time>{row.start_time?.slice(0, 5) || "—"}</time><div><h3>{row.subject_name || row.title}</h3><p>{row.study_date.split("-").reverse().join("/")} · {row.end_time?.slice(0, 5)} · {row.room || "Chưa có phòng"}</p></div></article>)}</div>}
      <Link className="profile-text-link" to="/schedule">Mở thời khóa biểu đầy đủ <ArrowRight size={15} /></Link>
    </section>
  );
}

export function SettingsPanel({ onEdit, onEditGoal }) {
  return (
    <section className="settings-profile-grid" aria-label="Cài đặt hồ sơ">
      <article className="profile-tab-section settings-profile-card"><span className="settings-panel-icon"><UserRound size={23} /></span><div><h2>Thông tin hồ sơ</h2><p>Cập nhật tên, mã sinh viên, email và ngành học.</p></div><Button variant="outline" onClick={onEdit}>Chỉnh sửa hồ sơ</Button></article>
      <article className="profile-tab-section settings-profile-card"><span className="settings-panel-icon"><Settings size={23} /></span><div><h2>Tùy chỉnh ứng dụng</h2><p>Thay đổi giao diện, màu nhấn và thiết lập thông báo.</p></div><Link className="btn btn-outline btn-md" to="/settings">Mở cài đặt</Link></article>
      <article className="profile-tab-section settings-profile-card"><span className="settings-panel-icon"><Award size={23} /></span><div><h2>Mục tiêu học tập</h2><p>Thiết lập GPA mục tiêu và lộ trình tín chỉ mong muốn.</p></div><Button variant="outline" onClick={onEditGoal}>Chỉnh sửa mục tiêu</Button></article>
    </section>
  );
}

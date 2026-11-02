import {
  Calendar,
  ChevronRight,
  Hash,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "../common/ui";

const present = (value) => value || "Chưa cập nhật";

export default function ProfileSidebar({ profile, stats, goal, onEdit, onEditGoal, onViewProgress }) {
  const information = [
    [UserRound, "Họ và tên", present(profile.fullName)],
    [Hash, "Mã sinh viên", present(profile.studentCode)],
    [Mail, "Email", present(profile.email)],
    [Phone, "Số điện thoại", present(profile.phone)],
    [Calendar, "Ngày sinh", present(profile.dateOfBirth)],
    [Users, "Giới tính", present(profile.gender)],
    [MapPin, "Địa chỉ", present(profile.address)],
  ];
  const goalPercent = Math.min(100, Math.max(0, Math.round((stats.gpa / goal) * 100) || 0));

  return (
    <aside className="profile-side" aria-label="Thông tin bổ sung">
      <section className="profile-panel personal-card">
        <div className="side-card-heading">
          <div><span>HỒ SƠ</span><h2>Thông tin cá nhân</h2></div>
          <button type="button" className="side-icon-button" aria-label="Chỉnh sửa thông tin cá nhân" title="Chỉnh sửa" onClick={onEdit}><Pencil size={16} /></button>
        </div>
        <div className="personal-info-list">
          {information.map(([Icon, label, value]) => (
            <div className="personal-info-row" key={label}>
              <span className="personal-info-icon"><Icon size={15} /></span>
              <div><small>{label}</small><strong>{value}</strong></div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="side-full-button" onClick={onEdit}><Pencil size={14} /> Chỉnh sửa</Button>
      </section>

      <section className="profile-panel progress-card">
        <div className="side-card-heading">
          <div><span>LỘ TRÌNH</span><h2>Tiến độ học tập</h2></div>
        </div>
        <div className="study-progress-visual">
          <div className="study-donut" role="img" aria-label={`Tiến độ tín chỉ: ${stats.creditPercent ?? "chưa có dữ liệu"}${stats.creditPercent === null ? "" : "%"}`} style={{ "--progress": `${(stats.creditPercent || 0) * 3.6}deg` }}>
            <div><strong>{stats.creditPercent === null ? "—" : `${stats.creditPercent}%`}</strong><span>Hoàn thành</span></div>
          </div>
          <div className="study-credit-list">
            <p><i className="credit-done" /><span>Tín chỉ hoàn thành</span><strong>{stats.completedCredits ?? "—"}</strong></p>
            <p><i className="credit-left" /><span>Tín chỉ còn lại</span><strong>{stats.creditPercent === null ? "—" : Math.max(0, stats.totalCredits - stats.completedCredits)}</strong></p>
            <p><i className="credit-total" /><span>Tổng tín chỉ</span><strong>{stats.totalCredits ?? "—"}</strong></p>
          </div>
        </div>
        <p className="credit-scope-note">Theo {stats.creditScope}</p>
        <button type="button" className="profile-text-link" onClick={onViewProgress}>Xem chi tiết <ChevronRight size={15} /></button>
      </section>

      <section className="profile-panel goal-card">
        <div className="goal-icon"><Target size={20} /></div>
        <span className="goal-kicker">MỤC TIÊU HỌC TẬP</span>
        <h2>Duy trì GPA ≥ {Number(goal).toFixed(1)} trong kỳ tới</h2>
        <div className="goal-progress-copy"><span>Tiến độ mục tiêu</span><strong>{goalPercent}%</strong></div>
        <div className="goal-progress"><span style={{ width: `${goalPercent}%` }} /></div>
        <Button variant="outline" className="side-full-button" onClick={onEditGoal}><Pencil size={14} /> Chỉnh sửa mục tiêu</Button>
      </section>
    </aside>
  );
}

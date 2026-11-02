import {
  BookOpen,
  Building2,
  GraduationCap,
  IdCard,
  Mail,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Button, LoadingSkeleton } from "../common/ui";
import foxAssets from "../../assets/foxAssets";

export default function ProfileHero({ profile, loading, onEdit }) {
  if (loading) {
    return <LoadingSkeleton className="profile-hero-skeleton" />;
  }

  return (
    <section className="profile-hero" aria-labelledby="profile-page-title">
      <div className="profile-hero-copy">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <img
              className="profile-avatar"
              src={profile.avatar || foxAssets["fox-student-avatar.png"]}
              alt="Ảnh đại diện sinh viên"
            />
            <span className="profile-online-dot" title="Hồ sơ đang hoạt động" />
          </div>
          <div className="profile-identity-copy">
            <span className="profile-role"><Sparkles size={13} /> Sinh viên</span>
            <p className="profile-page-label" id="profile-page-title">Hồ sơ sinh viên</p>
            <h1>{profile.fullName || "Sinh viên CMC"}</h1>
            <div className="profile-identity-meta">
              <span><IdCard size={15} /> {profile.studentCode || "Chưa có mã sinh viên"}</span>
              <span><Mail size={15} /> {profile.email || "Chưa cập nhật email"}</span>
            </div>
          </div>
        </div>

        <div className="profile-school-meta">
          <span><Building2 size={16} /> {profile.school || "Trường Đại học CMC"}</span>
          <span><BookOpen size={16} /> {profile.faculty || profile.major || "Khoa đang cập nhật"}</span>
          <span><GraduationCap size={16} /> {profile.cohort || profile.className || "Khóa học đang cập nhật"}</span>
        </div>

        <blockquote>“{profile.slogan || "Ngày hôm nay tốt hơn ngày hôm qua."}”</blockquote>
        <Button className="profile-edit-main" onClick={onEdit}>
          <Pencil size={15} /> Chỉnh sửa hồ sơ
        </Button>
      </div>

      <div className="profile-hero-art" aria-hidden="true">
        <span className="profile-art-orbit profile-art-orbit-one" />
        <span className="profile-art-orbit profile-art-orbit-two" />
        <div className="profile-art-chip profile-art-chip-book"><BookOpen size={21} /></div>
        <div className="profile-art-chip profile-art-chip-cap"><GraduationCap size={23} /></div>
        <img src={foxAssets["fox-study.png"]} alt="" />
        <div className="profile-art-note">
          <span>SMART STUDY HUB</span>
          <strong>Learn · Grow · Shine</strong>
        </div>
      </div>
    </section>
  );
}

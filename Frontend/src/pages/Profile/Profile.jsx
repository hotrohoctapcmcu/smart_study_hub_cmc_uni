import { useEffect, useMemo, useState } from "react";
import { studentApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { mapStudent, mapGrades, mapSubjects } from "../../utils/studentAdapter";
import { ErrorState, LoadingSkeleton, useAction } from "../../components/common/ui";
import ProfileHero from "../../components/profile/ProfileHero";
import ProfileTabs from "../../components/profile/ProfileTabs";
import StudyStats from "../../components/profile/StudyStats";
import GradeSection from "../../components/profile/GradeSection";
import ProfileSidebar from "../../components/profile/ProfileSidebar";
import ProfileEditModal from "../../components/profile/ProfileEditModal";
import StudyGoalModal from "../../components/profile/StudyGoalModal";
import { SubjectGrid, SemesterTimeline, Achievements, SchedulePanel, SettingsPanel } from "../../components/profile/ProfileTabPanels";
import { buildCourseRows, buildStudyStats, readProfilePreferences, saveProfilePreferences } from "../../components/profile/profileData";
import "./Profile.css";

export default function Profile() {
  const [semester, setSemester] = useState("");
  const [tab, setTab] = useState("info");
  const [allGrades, setAllGrades] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [form, setForm] = useState({});
  const [preferences, setPreferences] = useState({});
  const state = useApi(studentApi.getProfile);
  const grades = useApi(() => studentApi.getGrades(semester ? { hocKy: semester } : {}), { immediate: false });
  const subjects = useApi(studentApi.getSubjects);
  const { run, busy, notify } = useAction();
  const student = useMemo(() => mapStudent(state.data), [state.data]);
  const gradeRows = useMemo(() => mapGrades(responseList(grades.data, "grades")), [grades.data]);
  const subjectRows = useMemo(() => mapSubjects(responseList(subjects.data, "subjects")), [subjects.data]);
  const profile = { ...student, ...preferences.personal };
  const stats = buildStudyStats(allGrades, subjectRows, student, preferences.totalCredits);
  const semesters = [...new Set(allGrades.map((grade) => String(grade.semester || "")).filter(Boolean))];
  const courses = buildCourseRows(subjectRows, allGrades);

  useEffect(() => { grades.execute(); }, [semester, grades.execute]);
  useEffect(() => {
    if (grades.data && !semester) setAllGrades(gradeRows);
  }, [grades.data, gradeRows, semester]);
  useEffect(() => { setPreferences(readProfilePreferences(student.studentCode)); }, [student.studentCode]);

  const openEdit = () => { setForm(profile); setEditing(true); };
  const updatePreferences = (next) => {
    saveProfilePreferences(student.studentCode, next);
    setPreferences(next);
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    const saved = await run(async () => {
      await studentApi.updateProfile({
        fullName: form.fullName.trim(), studentCode: form.studentCode.trim(),
        major: form.major.trim(), email: form.email, phone: form.phone, dob: form.dateOfBirth,
      });
      const next = { ...preferences, personal: { gender: form.gender, address: form.address, slogan: form.slogan } };
      saveProfilePreferences(form.studentCode.trim(), next);
      setPreferences(next);
      await state.execute();
      window.dispatchEvent(new Event("workspace-updated"));
    }, "Đã cập nhật hồ sơ");
    if (saved) setEditing(false);
  };

  const gradeSection = <GradeSection state={grades} rows={gradeRows} semesters={semesters} semester={semester} onSemesterChange={setSemester} />;
  const mainPanel = tab === "subjects" ? <SubjectGrid state={subjects} courses={courses} />
    : tab === "schedule" ? <SchedulePanel />
      : tab === "semesters" ? grades.loading && !allGrades.length ? <LoadingSkeleton /> : <SemesterTimeline grades={allGrades} />
        : tab === "achievements" ? <Achievements stats={stats} goal={preferences.gpaGoal || 8} />
          : tab === "settings" ? <SettingsPanel onEdit={openEdit} onEditGoal={() => setEditingGoal(true)} />
            : <>{gradeSection}{tab === "info" && <SemesterTimeline grades={allGrades} compact />}</>;

  return (
    <div className="page profile-page">
      <ProfileHero profile={profile} loading={state.loading && !state.data} onEdit={openEdit} />
      {state.error && <ErrorState error={state.error} onRetry={state.refetch} title="Chưa thể tải hồ sơ sinh viên" />}
      <ProfileTabs value={tab} onChange={setTab} />
      <StudyStats stats={stats} loading={grades.loading && !allGrades.length} error={grades.error && !allGrades.length} />
      <div className="profile-body" role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`}>
        <div className="profile-main">{mainPanel}</div>
        <ProfileSidebar profile={profile} stats={stats} goal={preferences.gpaGoal || 8} onEdit={openEdit} onEditGoal={() => setEditingGoal(true)} onViewProgress={() => setTab("semesters")} />
      </div>
      <p className="profile-data-note">Kết quả học tập được tổng hợp từ dữ liệu đã đồng bộ. Mục tiêu và phần giới thiệu cá nhân được lưu trên thiết bị này.</p>
      <ProfileEditModal isOpen={editing} onClose={() => !busy && setEditing(false)} form={form} setForm={setForm} onSubmit={saveProfile} busy={busy} />
      <StudyGoalModal isOpen={editingGoal} onClose={() => setEditingGoal(false)} preferences={preferences} onSave={(goal) => {
        try { updatePreferences({ ...preferences, ...goal }); setEditingGoal(false); notify?.("Đã lưu mục tiêu học tập"); }
        catch { notify?.("Không thể lưu mục tiêu trên thiết bị này.", "error"); }
      }} />
    </div>
  );
}

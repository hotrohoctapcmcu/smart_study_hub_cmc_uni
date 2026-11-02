import { Award, BarChart3, BookOpenCheck, WalletCards } from "lucide-react";
import { LoadingSkeleton } from "../common/ui";

export default function StudyStats({ stats, loading, error }) {
  if (loading) return <section className="profile-stats" aria-label="Đang tải tổng quan học tập">{[1, 2, 3, 4].map((key) => <LoadingSkeleton key={key} className="profile-stat-skeleton" />)}</section>;
  const cards = [
    {
      key: "gpa",
      label: "GPA hiện tại",
      value: `${stats.gpaText} / 10`,
      detail: error ? "Chưa thể tải dữ liệu điểm" : stats.gpaDelta === null ? "Điểm trung bình hệ 10" : `${stats.gpaDelta >= 0 ? "+" : ""}${stats.gpaDelta.toFixed(1)} so với kỳ trước`,
      Icon: BarChart3,
      tone: "pink",
    },
    {
      key: "subjects",
      label: "Số môn đã học",
      value: `${stats.subjectCompleted} / ${stats.subjectTotal} môn`,
      detail: `${stats.subjectPercent}% hoàn thành`,
      progress: stats.subjectPercent,
      Icon: BookOpenCheck,
      tone: "mint",
    },
    {
      key: "rank",
      label: "Xếp loại học lực",
      value: stats.classification,
      detail: stats.gpa >= 7.7
        ? "Dự kiến: Giỏi nếu duy trì kết quả hiện tại"
        : "Giữ nhịp học đều để cải thiện xếp loại",
      Icon: Award,
      tone: "blue",
    },
    {
      key: "credits",
      label: "Tổng tín chỉ",
      value: `${stats.completedCredits ?? "—"} / ${stats.totalCredits ?? "—"} tín chỉ`,
      detail: stats.creditPercent === null ? "Chờ cập nhật tín chỉ" : `${stats.creditPercent}% ${stats.creditScope}`,
      progress: stats.creditPercent ?? undefined,
      Icon: WalletCards,
      tone: "violet",
    },
  ];

  return (
    <section className="profile-stats" aria-label="Tổng quan học tập">
      {cards.map(({ key, label, value, detail, progress, Icon, tone }) => (
        <article className={`profile-stat profile-stat-${tone}`} key={key}>
          <div className="profile-stat-top">
            <span className="profile-stat-icon"><Icon size={20} /></span>
            <span className="profile-stat-label">{label}</span>
          </div>
          <strong>{value}</strong>
          {progress !== undefined && (
            <div className="profile-stat-progress" aria-label={`${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <p>{detail}</p>
        </article>
      ))}
    </section>
  );
}
